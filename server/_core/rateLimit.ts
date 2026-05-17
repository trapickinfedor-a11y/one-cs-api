/**
 * Rate Limit Manager — persistent DB-backed rate limiting with Redis fallback.
 *
 * Fallback order:
 * 1. Redis  — INCR with TTL (fast, multi-worker, same process)
 * 2. MySQL  — INSERT ON DUPLICATE KEY UPDATE
 * 3. In-memory Map — final fallback when neither Redis nor DB are available
 *
 * Uses bucketed windows (per-minute, per-day) as the primary algorithm.
 * Sliding window support is kept as an internal helper for future use.
 */

import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { apiRateLimits } from "../../drizzle/schema";
import { ENV } from "./env";

// === Constants ===

const MINUTE_TTL_SECONDS = 120; // keep minute records for 2 minutes
const DAILY_TTL_SECONDS = 90000; // keep daily records for ~25 hours

// === Redis client (lazy singleton, same pattern as proxy.ts) ===

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

// === In-memory fallback store (final fallback) ===

interface InMemoryRateEntry {
  hits: number;
  windowKey: string;
}

const _inMemoryStore = new Map<string, InMemoryRateEntry>();

function _inMemoryGet(keyPrefix: string, windowType: "minute" | "daily"): InMemoryRateEntry | undefined {
  return _inMemoryStore.get(`${keyPrefix}:${windowType}`);
}

function _inMemorySet(
  keyPrefix: string,
  windowType: "minute" | "daily",
  entry: InMemoryRateEntry,
) {
  _inMemoryStore.set(`${keyPrefix}:${windowType}`, entry);
}

function _inMemoryCleanup(windowType: "minute" | "daily", windowKey: string) {
  // Collect keys to delete to avoid mutating during iteration
  const toDelete: string[] = [];
  _inMemoryStore.forEach((entry, k) => {
    if (k.endsWith(`:${windowType}`) && entry.windowKey !== windowKey) {
      toDelete.push(k);
    }
  });
  for (let i = 0; i < toDelete.length; i++) {
    _inMemoryStore.delete(toDelete[i]);
  }
}

// === Window key helpers ===

function getMinuteWindowKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}`;
}

function getDailyWindowKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
}

function getWindowKey(windowType: "minute" | "daily"): string {
  return windowType === "minute" ? getMinuteWindowKey() : getDailyWindowKey();
}

function getRedisKey(keyPrefix: string, windowType: "minute" | "daily", windowKey: string): string {
  return `rl:${windowType}:${keyPrefix}:${windowKey}`;
}

// === Redis rate limit operations ===

async function redisIncrement(
  keyPrefix: string,
  windowType: "minute" | "daily",
): Promise<number | null> {
  const r = await getRedis();
  if (!r) return null;

  const windowKey = getWindowKey(windowType);
  const redisKey = getRedisKey(keyPrefix, windowType, windowKey);
  const ttl = windowType === "minute" ? MINUTE_TTL_SECONDS : DAILY_TTL_SECONDS;

  try {
    const exists = await r.get(redisKey);
    if (exists !== null) {
      await r.set(redisKey, String(Number(exists) + 1), { EX: ttl });
      return Number(exists) + 1;
    } else {
      await r.set(redisKey, "1", { EX: ttl });
      return 1;
    }
  } catch {
    return null;
  }
}

async function redisGetHits(
  keyPrefix: string,
  windowType: "minute" | "daily",
): Promise<number | null> {
  const r = await getRedis();
  if (!r) return null;

  const windowKey = getWindowKey(windowType);
  const redisKey = getRedisKey(keyPrefix, windowType, windowKey);

  try {
    const val = await r.get(redisKey);
    return val !== null ? Number(val) : 0;
  } catch {
    return null;
  }
}

// === MySQL rate limit operations ===

let _dbRL: ReturnType<typeof drizzle> | null = null;

async function getDbRL() {
  if (_dbRL) return _dbRL;
  if (!ENV.databaseUrl) return null;
  try {
    _dbRL = drizzle(ENV.databaseUrl);
    // Test connection
    await _dbRL.execute("SELECT 1");
    return _dbRL;
  } catch {
    _dbRL = null;
    return null;
  }
}

async function mysqlIncrementHits(
  keyPrefix: string,
  windowType: "minute" | "daily",
): Promise<number | null> {
  const db = await getDbRL();
  if (!db) return null;

  const windowKey = getWindowKey(windowType);
  const now = new Date();

  try {
    await db.execute(
      sql`INSERT INTO api_rate_limits (key_prefix, window_key, window_type, hits, created_at, updated_at)
          VALUES (${keyPrefix}, ${windowKey}, ${windowType}, 1, ${now}, ${now})
          ON DUPLICATE KEY UPDATE hits = hits + 1, updated_at = ${now}`,
    );

    const rows = await db
      .select({ hits: apiRateLimits.hits })
      .from(apiRateLimits)
      .where(
        and(
          eq(apiRateLimits.keyPrefix, keyPrefix),
          eq(apiRateLimits.windowKey, windowKey),
        ),
      )
      .limit(1);

    return rows.length > 0 ? Number(rows[0].hits) : 1;
  } catch {
    return null;
  }
}

async function mysqlGetHits(
  keyPrefix: string,
  windowType: "minute" | "daily",
): Promise<number | null> {
  const db = await getDbRL();
  if (!db) return null;

  const windowKey = getWindowKey(windowType);

  try {
    const rows = await db
      .select({ hits: apiRateLimits.hits })
      .from(apiRateLimits)
      .where(
        and(
          eq(apiRateLimits.keyPrefix, keyPrefix),
          eq(apiRateLimits.windowKey, windowKey),
        ),
      )
      .limit(1);

    return rows.length > 0 ? Number(rows[0].hits) : 0;
  } catch {
    return null;
  }
}

// === Public API ===

/**
 * Get current hits for a key prefix within the given window type.
 * Falls back through Redis -> MySQL -> in-memory -> 0.
 */
export async function getRateLimitHits(
  keyPrefix: string,
  windowType: "minute" | "daily",
): Promise<number> {
  const currentWindowKey = getWindowKey(windowType);

  // Try in-memory first for same-process cache
  const memEntry = _inMemoryGet(keyPrefix, windowType);
  if (memEntry && memEntry.windowKey === currentWindowKey) {
    return memEntry.hits;
  }

  // Try Redis
  const redisHits = await redisGetHits(keyPrefix, windowType);
  if (redisHits !== null) return redisHits;

  // Try MySQL
  const mysqlHits = await mysqlGetHits(keyPrefix, windowType);
  if (mysqlHits !== null) return mysqlHits;

  return 0;
}

/**
 * Increment hit counter and return the new hit count.
 * Falls back through Redis -> MySQL -> in-memory Map.
 */
export async function incrementRateLimit(
  keyPrefix: string,
  windowType: "minute" | "daily",
): Promise<number> {
  const currentWindowKey = getWindowKey(windowType);

  // Try Redis first
  const redisHits = await redisIncrement(keyPrefix, windowType);
  if (redisHits !== null) {
    _inMemorySet(keyPrefix, windowType, {
      hits: redisHits,
      windowKey: currentWindowKey,
    });
    return redisHits;
  }

  // Try MySQL
  const mysqlHits = await mysqlIncrementHits(keyPrefix, windowType);
  if (mysqlHits !== null) {
    _inMemorySet(keyPrefix, windowType, {
      hits: mysqlHits,
      windowKey: currentWindowKey,
    });
    return mysqlHits;
  }

  // Final fallback: in-memory Map
  const memEntry = _inMemoryGet(keyPrefix, windowType);
  if (memEntry && memEntry.windowKey === currentWindowKey) {
    memEntry.hits += 1;
    _inMemorySet(keyPrefix, windowType, memEntry);
    return memEntry.hits;
  }

  _inMemorySet(keyPrefix, windowType, {
    hits: 1,
    windowKey: currentWindowKey,
  });
  return 1;
}

/**
 * Cleanup old in-memory entries (call periodically to prevent unbounded growth).
 */
export function cleanupInMemoryStore(): void {
  _inMemoryCleanup("minute", getMinuteWindowKey());
  _inMemoryCleanup("daily", getDailyWindowKey());
}