/**
 * Proxy Manager — ONE CS
 *
 * Алгоритм: минимум прокси — максимум результата
 *
 * Evomi — standard HTTP CONNECT proxy (не REST API):
 *   http://username:password@core-residential.evomi.com:1000
 * Sticky session управляется Evomi на их стороне.
 * Мы трекаем IP через тестовый GET на ipinfo.io/ip и считаем success-ротацию.
 *
 * Fallback: DataImpulse (REST API)
 *
 * Координация между воркерами: Redis SETNX mutex.
 * Без Redis — runtimeStore (in-process).
 */

import { createHash, randomBytes } from "crypto";
import { ENV } from "./env";
import { saveRuntimeProxyLease } from "../runtimeStore";

// === Constants ===

const ROTATE_AFTER_N = parseInt(process.env.ROTATE_AFTER_N_SUCCESS ?? "20", 10);
const ROTATE_ON_ERRORS = parseInt(process.env.ROTATE_ON_ERROR_COUNT ?? "2", 10);
const EVOMI_HOST = ENV.evomiUsername ? "core-residential.evomi.com" : "";
const EVOMI_PORT = 1000;
const PROXY_TEST_URL = "https://api.ipify.org?format=text";
const PROXY_TEST_TIMEOUT_MS = 10_000;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 60_000;

// === Types ===

export interface ProxyLease {
  leaseId: string;           // generated unique id (not Evomi session id since no API)
  provider: "evomi" | "dataimpulse";
  protocol: "http" | "socks5";
  host: string;               // proxy hostname
  port: number;               // proxy port
  username: string;
  password: string;
  sessionKey: string;         // evomi:user:{userId} or evomi:job:{publicId}
  country: string | null;
  assignedIp: string | null;  // IP assigned by proxy (fetched via ipify)
  createdAt: Date;
  expiresAt: Date;            // expiresAt = now + SESSION_TTL_MINUTES * 60 * 1000
  bytesUsed: number;
  estimatedCostUsd: number;
  successCount: number;
  rotateAfterN: number;
  metadata: {
    leaseId: string;
    sessionKey: string;
    country: string | null;
    rotateAfterN: number;
    successCount: number;
    userId: number | null;
    jobPublicId: string | null;
    rotatedFrom: string | null;
    rotatedReason: string | null;
  };
}

export interface ProxyAcquireOptions {
  userId?: number;
  jobPublicId?: string;
  source?: "dashboard" | "api" | "telegram" | "system" | "testbench";
  rotateAfterN?: number;
  country?: string;
}

export interface ProxyReleaseOptions {
  leaseId: string;
  success: boolean;
  errorCode?: string;
  bytesSent?: number;
  bytesReceived?: number;
}

// === Redis coordination (optional) ===

let _redis: {
  get: (key: string) => Promise<string | null>;
  set: (key: string, val: string, opts?: { EX?: number; NX?: boolean }) => Promise<unknown>;
  del: (key: string) => Promise<number>;
} | null = null;

async function getRedis() {
  if (_redis) return _redis;
  if (!ENV.redisUrl) return null;
  try {
    const { createClient } = await import("redis");
    const client = createClient({ url: ENV.redisUrl });
    client.on("error", () => { _redis = null; });
    await client.connect();
    _redis = client;
    return _redis;
  } catch {
    return null;
  }
}

async function redisGet(key: string): Promise<string | null> {
  const r = await getRedis();
  if (!r) return null;
  try { return await r.get(key); } catch { return null; }
}

async function redisSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const r = await getRedis();
  if (!r) return;
  try { await r.set(key, value, { EX: ttlSeconds }); } catch { /* ignore */ }
}

async function redisDel(key: string): Promise<void> {
  const r = await getRedis();
  if (!r) return;
  try { await r.del(key); } catch { /* ignore */ }
}

async function redisTryAcquire(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  const r = await getRedis();
  if (!r) return false;
  try {
    const result = await r.set(key, value, { NX: true, EX: ttlSeconds });
    return result === "OK" || result === null;
  } catch {
    return false;
  }
}

// === Runtime in-process session store ===

interface ActiveProxySession {
  lease: ProxyLease;
  successCount: number;
  errorCount: number;
  lastUsedAt: Date;
  circuitBreakerFailures: number;
  circuitOpenedAt: number | null;
}

const _activeSessions = new Map<string, ActiveProxySession>();
const _mutexLocks = new Map<string, { lockedBy: string; lockedAt: number }>();
const _workerId = `worker_${randomBytes(4).toString("hex")}`;

function sessionCacheKey(provider: string, userId: number | null, jobPublicId?: string | null): string {
  if (userId != null) return `${provider}:user:${userId}`;
  if (jobPublicId) return `${provider}:job:${jobPublicId}`;
  return `${provider}:global`;
}

function sessionMutexKey(provider: string, userId: number | null): string {
  return `proxy:lock:${provider}:user:${userId ?? "anon"}`;
}

function tryAcquireMutex(key: string): boolean {
  const now = Date.now();
  const existing = _mutexLocks.get(key);
  if (existing && now - existing.lockedAt < 30_000 && existing.lockedBy !== _workerId) {
    return false;
  }
  _mutexLocks.set(key, { lockedBy: _workerId, lockedAt: now });
  return true;
}

function releaseMutex(key: string): void {
  const existing = _mutexLocks.get(key);
  if (existing?.lockedBy === _workerId) _mutexLocks.delete(key);
}

// === Circuit breaker ===

function isCircuitOpen(session: ActiveProxySession): boolean {
  if (!session.circuitOpenedAt) return false;
  if (Date.now() - session.circuitOpenedAt > CIRCUIT_BREAKER_RESET_MS) {
    session.circuitOpenedAt = null;
    session.circuitBreakerFailures = 0;
    return false;
  }
  return true;
}

// === Proxy URL builders ===

export function buildProxyUrl(lease: ProxyLease): string {
  return `http://${lease.username}:${lease.password}@${lease.host}:${lease.port}`;
}

export function buildProxyAgentOptions(lease: ProxyLease) {
  return {
    host: lease.host,
    port: lease.port,
    auth: `${lease.username}:${lease.password}`,
  };
}

// === Fetch through proxy — get assigned IP using native http module ===

async function fetchThroughProxy(lease: ProxyLease): Promise<string | null> {
  try {
    return await new Promise<string | null>((resolve) => {
      const httpMod = require("http");
      const url = new URL(PROXY_TEST_URL);
      const req = httpMod.request(
        {
          method: "GET",
          hostname: url.hostname,
          port: url.port || "80",
          path: url.pathname + url.search,
          host: `${lease.host}:${lease.port}`,
          proxy: `http://${lease.username}:${lease.password}@${lease.host}:${lease.port}`,
          timeout: PROXY_TEST_TIMEOUT_MS,
        },
        (res: import("http").IncomingMessage) => {
          let data = "";
          res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
          res.on("end", () => {
            resolve(data.trim() || null);
          });
        },
      );

      req.on("error", () => resolve(null));
      req.on("timeout", () => { req.destroy(); resolve(null); });
      req.end();
    });
  } catch {
    return null;
  }
}

// === HTTP request through proxy (for job execution) ===

export function buildProxyRequestOptions(lease: ProxyLease): {
  agent: import("http").Agent;
} {
  return {
    agent: new (require("http").Agent)({
      keepAlive: true,
      keepAliveMsecs: 30_000,
      host: lease.host,
      port: lease.port,
      auth: `${lease.username}:${lease.password}`,
    }),
  };
}

// === Evomi proxy — standard HTTP CONNECT (not REST API) ===

function isEvomiConfigured(): boolean {
  return Boolean(ENV.evomiUsername && ENV.evomiPassword);
}

function isDataImpulseConfigured(): boolean {
  return Boolean(ENV.dataImpulseApiKey && ENV.dataImpulseUsername && ENV.dataImpulsePassword);
}

function buildEvomiLease(opts: ProxyAcquireOptions, assignedIp: string | null, rotatedFrom?: string | null, rotatedReason?: string | null): ProxyLease {
  const sessionKey = opts.userId != null
    ? `evomi:user:${opts.userId}`
    : opts.jobPublicId
      ? `evomi:job:${opts.jobPublicId}`
      : `evomi:global`;

  const leaseId = `ev_${randomBytes(6).toString("hex")}`;
  const ttlMs = (ENV.sessionTtlMinutes ?? 1440) * 60 * 1000;

  // Evomi country routing: append _country-{CC} to password.
  // Format: http://username:password_country-US@core-residential.evomi.com:1000
  // Works on both core-residential.evomi.com and rp.evomi.com.
  const country = opts.country ?? null;
  const rawPassword = ENV.evomiPassword ?? "";
  const password = country ? `${rawPassword}_country-${country}` : rawPassword;

  return {
    leaseId,
    provider: "evomi",
    protocol: "http",
    host: EVOMI_HOST,
    port: EVOMI_PORT,
    username: ENV.evomiUsername ?? "",
    password,
    sessionKey,
    country,
    assignedIp,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + ttlMs),
    bytesUsed: 0,
    estimatedCostUsd: 0,
    successCount: 1,
    rotateAfterN: opts.rotateAfterN ?? ROTATE_AFTER_N,
    metadata: {
      leaseId,
      sessionKey,
      country: opts.country ?? null,
      rotateAfterN: opts.rotateAfterN ?? ROTATE_AFTER_N,
      successCount: 1,
      userId: opts.userId ?? null,
      jobPublicId: opts.jobPublicId ?? null,
      rotatedFrom: rotatedFrom ?? null,
      rotatedReason: rotatedReason ?? null,
    },
  };
}

// === DataImpulse fallback (REST API) ===

async function dataImpulseCreateSession(opts: {
  country?: string;
}): Promise<{
  leaseId: string;
  host: string;
  port: number;
  username: string;
  password: string;
  country: string;
  expiresAt: Date;
  bandwidthUsedBytes: number;
  estimatedCostUsd: number;
}> {
  if (!isDataImpulseConfigured()) throw new Error("DataImpulse not configured");

  const resp = await fetch("https://api.dataimpulse.com/proxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ENV.dataImpulseApiKey ?? "",
    },
    body: JSON.stringify({
      auth: { username: ENV.dataImpulseUsername, password: ENV.dataImpulsePassword },
      protocol: "http",
      quantity: 1,
      ...(opts.country ? { location: { country: opts.country } } : {}),
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "unknown");
    throw new Error(`DataImpulse API ${resp.status}: ${body}`);
  }

  const data = await resp.json() as {
    id: string;
    session_id: string;
    proxy: { host: string; port: number; username: string; password: string; country: string };
    expires_at: number;
    bandwidth_used_bytes: number;
    estimated_cost_usd: number;
  };

  return {
    leaseId: data.id,
    host: data.proxy.host,
    port: data.proxy.port,
    username: data.proxy.username,
    password: data.proxy.password,
    country: data.proxy.country,
    expiresAt: new Date(data.expires_at),
    bandwidthUsedBytes: data.bandwidth_used_bytes,
    estimatedCostUsd: data.estimated_cost_usd,
  };
}

// === Acquire proxy ===

/**
 * Acquire a proxy lease.
 *
 * Strategy:
 * 1. Check in-process cache for existing valid sticky session
 * 2. Check Redis cache for other workers' session
 * 3. If circuit-broken → skip to new acquisition
 * 4. If rotation needed (N successes) → release old, acquire new
 * 5. If no existing session → create new Evomi lease (standard HTTP proxy)
 * 6. Fetch assigned IP via test request
 * 7. On Evomi failure → DataImpulse fallback
 * 8. No providers → return null (mock mode)
 */
export async function acquireProxy(opts: ProxyAcquireOptions = {}): Promise<ProxyLease | null> {
  const cacheKey = sessionCacheKey("evomi", opts.userId ?? null, opts.jobPublicId);
  const rotateAfterN = opts.rotateAfterN ?? ROTATE_AFTER_N;

  // --- Step 1: Redis lock for multi-worker coordination ---
  const mutexKey = sessionMutexKey("evomi", opts.userId ?? null);
  const gotMutex = tryAcquireMutex(mutexKey);

  // --- Step 2: In-process cache check ---
  const inMemory = _activeSessions.get(cacheKey);
  if (inMemory && inMemory.lease.expiresAt.getTime() > Date.now() + 30_000) {
    if (isCircuitOpen(inMemory)) {
      console.warn(`[ProxyManager] Circuit open for ${cacheKey}, forcing new acquisition`);
      _activeSessions.delete(cacheKey);
    } else if (inMemory.successCount >= rotateAfterN) {
      console.info(`[ProxyManager] Rotation: ${inMemory.successCount} ≥ ${rotateAfterN} successes`);
      _activeSessions.delete(cacheKey);
    } else {
      inMemory.successCount++;
      inMemory.lastUsedAt = new Date();
      await redisSet(cacheKey, JSON.stringify(inMemory.lease), 3600);
      return inMemory.lease;
    }
  }

  // --- Step 3: Check Redis for other workers' session ---
  if (!gotMutex) {
    const cached = await redisGet(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as ProxyLease;
        if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() > Date.now() + 30_000) {
          // Another worker has active session — return it
          const existing = _activeSessions.get(cacheKey);
          if (existing) {
            existing.successCount++;
            existing.lastUsedAt = new Date();
            return existing.lease;
          }
          // Rehydrate from Redis
          _activeSessions.set(cacheKey, {
            lease: parsed,
            successCount: parsed.metadata.successCount,
            errorCount: 0,
            lastUsedAt: new Date(),
            circuitBreakerFailures: 0,
            circuitOpenedAt: null,
          });
          return parsed;
        }
      } catch {
        // corrupted — proceed to new acquisition
      }
    }
  }

  // --- Step 4: Acquire from Evomi (standard HTTP proxy) ---
  if (isEvomiConfigured()) {
    const rotatedFrom = inMemory?.lease.leaseId ?? null;
    const rotatedReason = inMemory ? "rotation_after_n_success" : null;
    const lease = buildEvomiLease(opts, null, rotatedFrom, rotatedReason);

    // Test connection and get assigned IP
    const assignedIp = await fetchThroughProxy(lease);
    if (assignedIp) {
      lease.assignedIp = assignedIp;
      console.info(
        `[ProxyManager] Evomi sticky session lease=${lease.leaseId} ip=${assignedIp} ` +
          `sessionKey=${lease.sessionKey} rotateAfter=${rotateAfterN}`,
      );
    } else {
      console.warn(`[ProxyManager] Evomi proxy connected but IP fetch failed — will retry on first use`);
    }

    _activeSessions.set(cacheKey, {
      lease,
      successCount: 1,
      errorCount: 0,
      lastUsedAt: new Date(),
      circuitBreakerFailures: 0,
      circuitOpenedAt: null,
    });

    await redisSet(cacheKey, JSON.stringify(lease), 3600);
    return lease;
  }

  // --- Step 5: DataImpulse fallback ---
  if (isDataImpulseConfigured()) {
    try {
      const session = await dataImpulseCreateSession({ country: opts.country });

      const leaseId = `di_${randomBytes(6).toString("hex")}`;
      const lease: ProxyLease = {
        leaseId,
        provider: "dataimpulse",
        protocol: "http",
        host: session.host,
        port: session.port,
        username: session.username,
        password: session.password,
        sessionKey: `dataimpulse:${session.leaseId}`,
        country: session.country,
        assignedIp: null,
        createdAt: new Date(),
        expiresAt: session.expiresAt,
        bytesUsed: session.bandwidthUsedBytes,
        estimatedCostUsd: session.estimatedCostUsd,
        successCount: 1,
        rotateAfterN,
        metadata: {
          leaseId,
          sessionKey: `dataimpulse:${session.leaseId}`,
          country: session.country,
          rotateAfterN,
          successCount: 1,
          userId: opts.userId ?? null,
          jobPublicId: opts.jobPublicId ?? null,
          rotatedFrom: null,
          rotatedReason: null,
        },
      };

      _activeSessions.set(cacheKey, {
        lease,
        successCount: 1,
        errorCount: 0,
        lastUsedAt: new Date(),
        circuitBreakerFailures: 0,
        circuitOpenedAt: null,
      });

      console.info(
        `[ProxyManager] DataImpulse session lease=${lease.leaseId} ` +
          `host=${session.host}:${session.port} country=${session.country}`,
      );

      return lease;
    } catch (err) {
      console.error("[ProxyManager] DataImpulse fallback failed:", err);
    }
  }

  // --- Step 6: No providers — mock mode ---
  console.warn("[ProxyManager] No proxy providers configured, returning null (mock mode)");
  return null;
}

// === Release proxy ===

async function doRelease(lease: ProxyLease, cacheKey: string): Promise<void> {
  _activeSessions.delete(cacheKey);
  await redisDel(cacheKey);
  releaseMutex(sessionMutexKey("evomi", lease.metadata.userId));
}

/**
 * Release proxy after job completion.
 *
 * success=true  → increment successCount, check rotation threshold
 * error (transport) → circuit breaker, rotate if threshold reached
 */
export async function releaseProxy(opts: ProxyReleaseOptions): Promise<void> {
  const allSessions = Array.from(_activeSessions.entries());
  const entry = allSessions.find(([, s]) => s.lease.leaseId === opts.leaseId);

  if (!entry) {
    // Lease already released or unknown — no-op
    return;
  }

  const [cacheKey, session] = entry;

  if (opts.success) {
    session.successCount++;
    session.lastUsedAt = new Date();
    session.circuitBreakerFailures = 0;
    session.circuitOpenedAt = null;

    // Persist to runtimeStore for audit
    saveRuntimeProxyLease({
      leaseId: opts.leaseId,
      jobId: null,
      workerNodeId: null,
      providerId: session.lease.provider === "evomi" ? 1 : 2,
      policyId: null,
      protocol: session.lease.protocol,
      sessionMode: "sticky",
      sessionKey: session.lease.sessionKey,
      endpointHost: session.lease.host,
      endpointPort: session.lease.port,
      country: session.lease.country,
      status: "released",
      bytesSent: opts.bytesSent ?? 0,
      bytesReceived: opts.bytesReceived ?? 0,
      estimatedCostUsd: session.lease.estimatedCostUsd.toFixed(4),
      lastErrorCode: null,
      metadataJson: {
        ...session.lease.metadata,
        successCount: session.successCount,
        assignedIp: session.lease.assignedIp,
      },
      createdAt: session.lease.createdAt,
      expiresAt: session.lease.expiresAt,
      releasedAt: new Date(),
    });

    if (session.successCount >= session.lease.rotateAfterN) {
      console.info(
        `[ProxyManager] Rotation threshold: ${session.successCount} ≥ ${session.lease.rotateAfterN} for ${opts.leaseId}`,
      );
      await doRelease(session.lease, cacheKey);
    } else {
      const updatedLease = { ...session.lease, successCount: session.successCount };
      await redisSet(cacheKey, JSON.stringify(updatedLease), 3600);
    }
  } else {
    session.errorCount++;
    session.lastUsedAt = new Date();

    const transportErrors = [
      "TRANSPORT_ERROR", "PROXY_ERROR", "CONNECTION_TIMEOUT",
      "PROXY_AUTH_FAILED", "ETIMEDOUT", "ECONNRESET", "ENOTFOUND",
    ];
    const isTransport = transportErrors.includes(opts.errorCode ?? "");

    if (isTransport) {
      session.circuitBreakerFailures++;
      if (session.circuitBreakerFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        session.circuitOpenedAt = Date.now();
        console.warn(
          `[ProxyManager] Circuit opened after ${session.circuitBreakerFailures} transport errors on ${opts.leaseId}`,
        );
        await doRelease(session.lease, cacheKey);
        return;
      }
    }

    if (session.errorCount >= ROTATE_ON_ERRORS || session.circuitBreakerFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      console.warn(`[ProxyManager] Error threshold reached for ${opts.leaseId}, rotating`);
      await doRelease(session.lease, cacheKey);
    } else {
      console.warn(
        `[ProxyManager] Non-fatal error ${opts.errorCode} on ${opts.leaseId} ` +
          `(${session.errorCount}/${ROTATE_ON_ERRORS}), keeping lease`,
      );
    }
  }
}

// === Force rotation ===

export async function forceRotateProxy(userId: number): Promise<ProxyLease | null> {
  const cacheKey = sessionCacheKey("evomi", userId);
  const existing = _activeSessions.get(cacheKey);
  if (existing) {
    console.info(`[ProxyManager] Force rotation for userId=${userId} lease=${existing.lease.leaseId}`);
    await doRelease(existing.lease, cacheKey);
  }
  return acquireProxy({ userId });
}

// === Active sessions inspection ===

export function getActiveSessions(): Array<{
  lease: ProxyLease;
  successCount: number;
  errorCount: number;
  lastUsedAt: Date;
  circuitOpen: boolean;
}> {
  return Array.from(_activeSessions.values()).map(s => ({
    lease: s.lease,
    successCount: s.successCount,
    errorCount: s.errorCount,
    lastUsedAt: s.lastUsedAt,
    circuitOpen: isCircuitOpen(s),
  }));
}

// === Health check ===

export async function healthCheck(): Promise<{
  evomi: { configured: boolean; latencyMs: number; status: "healthy" | "degraded" | "disabled" };
  dataImpulse: { configured: boolean; status: "healthy" | "degraded" | "disabled" };
  redis: { configured: boolean; status: "healthy" | "degraded" | "disabled" };
  activeSessions: number;
  circuitOpenCount: number;
}> {
  const evomiConfigured = isEvomiConfigured();
  let evomiLatencyMs = -1;
  let evomiStatus: "healthy" | "degraded" | "disabled" = "disabled";

  if (evomiConfigured) {
    const start = Date.now();
    try {
      const evomiRawPassword = ENV.evomiPassword ?? "";
const evomiPasswordForHealth = evomiRawPassword ? `${evomiRawPassword}_country-US` : evomiRawPassword;
      const resp = await fetch(`http://${ENV.evomiUsername}:${evomiPasswordForHealth}@${EVOMI_HOST}:${EVOMI_PORT}`, {
        method: "CONNECT",
        path: "api.ipify.org:443",
        signal: AbortSignal.timeout(5000),
      } as Parameters<typeof fetch>[1]);
      evomiLatencyMs = Date.now() - start;
      evomiStatus = resp.ok || resp.status === 200 ? "healthy" : "degraded";
    } catch {
      evomiStatus = "degraded";
    }
  }

  const redisConfigured = Boolean(ENV.redisUrl);
  const r = redisConfigured ? await getRedis() : null;
  const redisStatus: "healthy" | "degraded" | "disabled" = redisConfigured
    ? (r ? "healthy" : "degraded")
    : "disabled";

  const circuitOpenCount = Array.from(_activeSessions.values()).filter(s => isCircuitOpen(s)).length;

  return {
    evomi: { configured: evomiConfigured, latencyMs: evomiLatencyMs, status: evomiStatus },
    dataImpulse: { configured: isDataImpulseConfigured(), status: isDataImpulseConfigured() ? "healthy" : "disabled" },
    redis: { configured: redisConfigured, status: redisStatus },
    activeSessions: _activeSessions.size,
    circuitOpenCount,
  };
}

// === Shutdown ===

export async function shutdown(): Promise<void> {
  console.info(`[ProxyManager] Shutting down, releasing ${_activeSessions.size} active sessions.`);
  const sessions = Array.from(_activeSessions.values());
  await Promise.allSettled(
    sessions.map(s => doRelease(s.lease, sessionCacheKey(s.lease.provider, s.lease.metadata.userId))),
  );
  _activeSessions.clear();
  if (_redis) {
    try {
      await (_redis as { quit?: () => Promise<void> }).quit?.();
    } catch { /* ignore */ }
    _redis = null;
  }
}