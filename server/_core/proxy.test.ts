import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as proxyModule from "./proxy";

// Mock runtimeStore
vi.mock("../runtimeStore", () => ({
  saveRuntimeProxyLease: vi.fn(),
  updateRuntimeProxyLease: vi.fn(),
}));

describe("Proxy Manager", () => {
  beforeEach(() => {
    // Reset env so we're in mock mode
    process.env.EVOMI_USERNAME = "";
    process.env.EVOMI_PASSWORD = "";
    process.env.DATAIMPULSE_API_KEY = "";
    process.env.REDIS_URL = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("acquireProxy — mock mode (no providers)", () => {
    it("returns null when no proxy providers are configured", async () => {
      const result = await proxyModule.acquireProxy({});
      expect(result).toBeNull();
    });

    it("returns null with userId context in mock mode", async () => {
      const result = await proxyModule.acquireProxy({ userId: 42 });
      expect(result).toBeNull();
    });

    it("returns null with jobPublicId context in mock mode", async () => {
      const result = await proxyModule.acquireProxy({ jobPublicId: "job_test_123" });
      expect(result).toBeNull();
    });
  });

  describe("getActiveSessions", () => {
    it("returns empty array when no sessions acquired", () => {
      const sessions = proxyModule.getActiveSessions();
      expect(sessions).toHaveLength(0);
    });
  });

  describe("releaseProxy — unknown lease", () => {
    it("is a no-op for unknown lease id", async () => {
      await expect(proxyModule.releaseProxy({ leaseId: "unknown_lease_id", success: true })).resolves.toBeUndefined();
    });
  });

  describe("forceRotateProxy — mock mode", () => {
    it("returns null when no providers configured", async () => {
      const result = await proxyModule.forceRotateProxy(99);
      expect(result).toBeNull();
    });
  });
});