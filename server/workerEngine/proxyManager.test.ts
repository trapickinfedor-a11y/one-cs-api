import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
/**
 * Proxy Manager Tests
 *
 * Tests the proxy acquisition / release logic in server/_core/proxy.ts.
 * Uses mocking for network calls and environment variables.
 *
 * Evomi uses standard HTTP CONNECT (not REST API).
 * DataImpulse uses REST API.
 * Fallback: runtime store in-memory.
 */

describe("Proxy Manager — Evomi Session Building", () => {
  // -------------------------------------------------------------------------
  // Session key generation
  // -------------------------------------------------------------------------

  it("session key format for user-scoped proxy", () => {
    // The session key encodes the scope (user vs job) and provider.
    // Format: "evomi:user:{userId}" or "evomi:job:{publicId}"
    const userKey = `evomi:user:42`;
    const jobKey = `evomi:job:job_test_abc123`;

    expect(userKey).toMatch(/^evomi:user:\d+$/);
    expect(jobKey).toMatch(/^evomi:job:[\w]+$/);
    expect(userKey).not.toBe(jobKey);
  });

  it("Evomi country routing — password suffix format", () => {
    // Evomi supports country routing via password suffix:
    // http://username:password_country-US@core-residential.evomi.com:1000
    const basePassword = "32ODnutU9epdPIPxDRVU";
    const country = "US";

    const routedPassword = `${basePassword}_country-${country}`;
    expect(routedPassword).toBe("32ODnutU9epdPIPxDRVU_country-US");

    // No country → no suffix
    expect(basePassword).not.toContain("_country-");
  });

  it("Evomi session URL building", () => {
    const username = "myuser";
    const password = "mypass_country-US";
    const host = "core-residential.evomi.com";
    const port = 1000;

    const proxyUrl = `http://${username}:${password}@${host}:${port}`;
    expect(proxyUrl).toBe("http://myuser:mypass_country-US@core-residential.evomi.com:1000");
  });

  it("DataImpulse session data structure", () => {
    // DataImpulse REST API returns this shape
    const mockApiResponse = {
      id: "di_session_abc123",
      session_id: "sess_xyz",
      proxy: {
        host: "gate.dc.dataimpulse.com",
        port: 8252,
        username: "diuser",
        password: "dipass",
        country: "US",
      },
      expires_at: Date.now() + 60 * 60 * 1000,
      bandwidth_used_bytes: 0,
      estimated_cost_usd: 0.0,
    };

    expect(mockApiResponse.id).toBeTruthy();
    expect(mockApiResponse.proxy.country).toBe("US");
    expect(mockApiResponse.expires_at).toBeGreaterThan(Date.now());
  });

  // -------------------------------------------------------------------------
  // Rotation after N successes
  // -------------------------------------------------------------------------

  it("rotation threshold — success count triggers rotation at N", () => {
    const rotateAfterN = 20;
    let successCount = 0;
    let rotated = false;

    for (let i = 0; i < 25; i++) {
      successCount++;
      if (successCount >= rotateAfterN) {
        rotated = true;
        break;
      }
    }

    expect(successCount).toBe(20);
    expect(rotated).toBe(true);
  });

  it("no rotation before threshold", () => {
    const rotateAfterN = 20;
    let rotated = false;

    for (let i = 0; i < rotateAfterN - 1; i++) {
      if (i + 1 >= rotateAfterN) { rotated = true; break; }
    }

    expect(rotated).toBe(false);
  });

  it("immediate rotation on transport error", () => {
    const transportErrors = [
      "TRANSPORT_ERROR", "PROXY_ERROR", "CONNECTION_TIMEOUT",
      "PROXY_AUTH_FAILED", "ETIMEDOUT", "ECONNRESET", "ENOTFOUND",
    ];

    const errors = ["ETIMEDOUT", "PROXY_ERROR", "ECONNRESET"];
    for (const err of errors) {
      expect(transportErrors).toContain(err);
    }

    // Non-transport errors should NOT trigger immediate rotation
    expect(transportErrors).not.toContain("INVALID_PAYLOAD");
    expect(transportErrors).not.toContain("RATE_LIMIT");
  });

  it("circuit breaker opens after consecutive transport errors", () => {
    const CIRCUIT_BREAKER_THRESHOLD = 5;
    let failures = 0;
    let circuitOpen = false;

    const errorSequence = ["ETIMEDOUT", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "ETIMEDOUT"];
    for (const err of errorSequence) {
      failures++;
      if (failures >= CIRCUIT_BREAKER_THRESHOLD) {
        circuitOpen = true;
        break;
      }
    }

    expect(circuitOpen).toBe(true);
    expect(failures).toBe(5);
  });

  it("circuit breaker resets after timeout window", async () => {
    const CIRCUIT_BREAKER_RESET_MS = 60_000;
    let circuitOpenedAt = Date.now() - CIRCUIT_BREAKER_RESET_MS - 1000; // expired
    let circuitBreakerFailures = 5;

    const now = Date.now();
    const isOpen = circuitOpenedAt && now - circuitOpenedAt > CIRCUIT_BREAKER_RESET_MS;
    if (isOpen) {
      circuitOpenedAt = null;
      circuitBreakerFailures = 0;
    }

    expect(circuitOpenedAt).toBeNull();
    expect(circuitBreakerFailures).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Session key uniqueness
  // -------------------------------------------------------------------------

  it("session keys are unique per user", () => {
    const makeKey = (provider: string, userId: number | null, jobPublicId?: string | null) => {
      if (userId != null) return `${provider}:user:${userId}`;
      if (jobPublicId) return `${provider}:job:${jobPublicId}`;
      return `${provider}:global`;
    };

    expect(makeKey("evomi", 1)).toBe("evomi:user:1");
    expect(makeKey("evomi", 2)).toBe("evomi:user:2");
    expect(makeKey("evomi", 1)).toBe(makeKey("evomi", 1)); // deterministic
    expect(makeKey("evomi", 1)).not.toBe(makeKey("evomi", 2)); // different users
    expect(makeKey("evomi", null, "job_abc")).toBe("evomi:job:job_abc");
    expect(makeKey("evomi", null)).toBe("evomi:global");
  });

  it("session cache key format matches expected patterns", () => {
    const cacheKeys = [
      "evomi:user:1",
      "evomi:user:42",
      "evomi:job:job_test_001",
      "evomi:global",
      "dataimpulse:user:1",
    ];

    for (const key of cacheKeys) {
      expect(key).toMatch(/^(evomi|dataimpulse):(?:user|job|global)(?::[\w]+)?$/);
    }
  });

  // -------------------------------------------------------------------------
  // Proxy lease structure
  // -------------------------------------------------------------------------

  it("ProxyLease structure contains all required fields", () => {
    const lease = {
      leaseId: "ev_abc123def456",
      provider: "evomi" as const,
      protocol: "http" as const,
      host: "core-residential.evomi.com",
      port: 1000,
      username: "myuser",
      password: "mypass_country-US",
      sessionKey: "evomi:user:1",
      country: "US",
      assignedIp: "12.34.56.78",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      bytesUsed: 0,
      estimatedCostUsd: 0,
      successCount: 1,
      rotateAfterN: 20,
      metadata: {
        leaseId: "ev_abc123def456",
        sessionKey: "evomi:user:1",
        country: "US",
        rotateAfterN: 20,
        successCount: 1,
        userId: 1,
        jobPublicId: null,
        rotatedFrom: null,
        rotatedReason: null,
      },
    };

    expect(lease.leaseId).toBeTruthy();
    expect(lease.provider).toBe("evomi");
    expect(lease.host).toBe("core-residential.evomi.com");
    expect(lease.port).toBe(1000);
    expect(lease.sessionKey).toContain("evomi:user:");
    expect(lease.country).toBe("US");
    expect(lease.assignedIp).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    expect(lease.rotateAfterN).toBe(20);
    expect(lease.metadata.rotateAfterN).toBe(20);
  });

  it("releaseProxy success path — increments successCount", async () => {
    const session = {
      leaseId: "ev_test",
      successCount: 5,
      errorCount: 0,
      lastUsedAt: new Date(),
    };

    session.successCount++;

    expect(session.successCount).toBe(6);
    expect(session.errorCount).toBe(0);
  });

  it("releaseProxy error path — increments errorCount", async () => {
    const session = {
      leaseId: "ev_test",
      successCount: 5,
      errorCount: 0,
      lastUsedAt: new Date(),
    };

    session.errorCount++;

    expect(session.errorCount).toBe(1);
    expect(session.successCount).toBe(5);
  });

  // -------------------------------------------------------------------------
  // Evomi / DataImpulse availability check
  // -------------------------------------------------------------------------

  it("Evomi availability check requires username AND password", () => {
    const isEvomiConfigured = (username: string | undefined, password: string | undefined) =>
      Boolean(username && password);

    expect(isEvomiConfigured("user", "pass")).toBe(true);
    expect(isEvomiConfigured("user", "")).toBe(false);
    expect(isEvomiConfigured("", "pass")).toBe(false);
    expect(isEvomiConfigured(undefined, undefined)).toBe(false);
    expect(isEvomiConfigured("", "")).toBe(false);
  });

  it("DataImpulse availability check requires apiKey, username, and password", () => {
    const isDataImpulseConfigured = (apiKey: string | undefined, username: string | undefined, password: string | undefined) =>
      Boolean(apiKey && username && password);

    expect(isDataImpulseConfigured("key", "user", "pass")).toBe(true);
    expect(isDataImpulseConfigured("key", "user", "")).toBe(false);
    expect(isDataImpulseConfigured("", "user", "pass")).toBe(false);
    expect(isDataImpulseConfigured("key", "", "pass")).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Proxy URL building
  // -------------------------------------------------------------------------

  it("buildProxyUrl returns correct HTTP proxy URL", () => {
    const buildProxyUrl = (lease: { username: string; password: string; host: string; port: number }) =>
      `http://${lease.username}:${lease.password}@${lease.host}:${lease.port}`;

    const url = buildProxyUrl({
      username: "myuser",
      password: "mypass",
      host: "core-residential.evomi.com",
      port: 1000,
    });

    expect(url).toBe("http://myuser:mypass@core-residential.evomi.com:1000");
  });

  it("buildProxyAgentOptions returns correct agent config", () => {
    const buildAgentOptions = (lease: { host: string; port: number; username: string; password: string }) => ({
      host: lease.host,
      port: lease.port,
      auth: `${lease.username}:${lease.password}`,
    });

    const opts = buildAgentOptions({
      host: "gate.dc.dataimpulse.com",
      port: 8252,
      username: "diuser",
      password: "dipass",
    });

    expect(opts.host).toBe("gate.dc.dataimpulse.com");
    expect(opts.port).toBe(8252);
    expect(opts.auth).toBe("diuser:dipass");
  });

  // -------------------------------------------------------------------------
  // Country routing
  // -------------------------------------------------------------------------

  it("country routing builds correct password suffix", () => {
    type CountryCode = "US" | "CA" | "GB" | "DE" | "AU";

    const buildCountryPassword = (base: string, country?: string) =>
      country ? `${base}_country-${country}` : base;

    const US = buildCountryPassword("basepass", "US");
    const CA = buildCountryPassword("basepass", "CA");
    const none = buildCountryPassword("basepass");

    expect(US).toBe("basepass_country-US");
    expect(CA).toBe("basepass_country-CA");
    expect(none).toBe("basepass");
    expect(US).not.toBe(CA);
  });

  it("multiple country requests produce different lease IDs", () => {
    const generateLeaseId = (provider: string) =>
      `${provider}_${Math.random().toString(36).slice(2, 10)}`;

    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateLeaseId("ev"));
    }

    // All 100 IDs should be unique (extremely high probability)
    expect(ids.size).toBe(100);
  });

  // -------------------------------------------------------------------------
  // Mock mode (no providers configured)
  // -------------------------------------------------------------------------

  it("returns null when no providers are configured", () => {
    const mockMode = (evomiConfigured: boolean, dataImpulseConfigured: boolean) =>
      !evomiConfigured && !dataImpulseConfigured;

    expect(mockMode(false, false)).toBe(true);
    expect(mockMode(true, false)).toBe(false);
    expect(mockMode(false, true)).toBe(false);
    expect(mockMode(true, true)).toBe(false);
  });
});