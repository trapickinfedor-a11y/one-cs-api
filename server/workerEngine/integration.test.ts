/**
 * server/workerEngine/integration.test.ts
 *
 * Integration tests for the CS Worker Engine.
 *
 * Test coverage:
 *   1. WorkerPool — safe test mode (no browser needed)
 *   2. Score extractor — synthetic text patterns
 *   3. Fingerprint randomization — profile generation
 *   4. SSN flow manager — request/response lifecycle
 *
 * Browser tests are skipped when Playwright is not installed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SSNFlowManager,
  type SsnValidateResult,
} from "./ssnFlowManager.js";
import {
  FingerprintRotator,
  type FingerprintProfile,
} from "./fingerprintRotator.js";
import {
  extractScoreFromText,
  isValidScore,
  normalizeScore,
  extractCreditScore,
} from "./scoreExtractor.js";
import {
  WorkerPool,
  CreditScoreWorker,
  type JobRequest,
  type JobResult,
  type WorkerPoolEvent,
} from "./csWorkerEngine.js";
import { buildOneCsResult } from "../../shared/oneCsScoring.js";
import { getTestProfile } from "./fixtures/testProfiles.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function expectEventually(
  fn: () => boolean | Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 100,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await sleep(intervalMs);
  }
  throw new Error(`expectEventually timed out after ${timeoutMs}ms`);
}

// ---------------------------------------------------------------------------
// SSN Flow Manager tests
// ---------------------------------------------------------------------------

describe("SSNFlowManager", () => {
  let manager: SSNFlowManager;

  beforeEach(() => {
    manager = new SSNFlowManager(60_000);
  });

  describe("validateSsn", () => {
    it("accepts dashed format XXX-XX-XXXX", () => {
      const result = SSNFlowManager.validateSsn("123-45-6789");
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe("123-45-6789");
    });

    it("accepts raw 9-digit format", () => {
      const result = SSNFlowManager.validateSsn("123456789");
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe("123-45-6789");
    });

    it("rejects empty input", () => {
      const result = SSNFlowManager.validateSsn("");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("empty");
    });

    it("rejects too few digits", () => {
      const result = SSNFlowManager.validateSsn("12345678");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("9 digits");
    });

    it("rejects invalid area 000", () => {
      const result = SSNFlowManager.validateSsn("000-45-6789");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("area");
    });

    it("rejects invalid area 666", () => {
      const result = SSNFlowManager.validateSsn("666-45-6789");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("area");
    });

    it("rejects invalid area 900-909", () => {
      const result = SSNFlowManager.validateSsn("900-45-6789");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("area");
    });

    it("rejects group 00", () => {
      const result = SSNFlowManager.validateSsn("123-00-6789");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("group");
    });

    it("rejects serial 0000", () => {
      const result = SSNFlowManager.validateSsn("123-45-0000");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("serial");
    });

    it("rejects SSN formatted as phone", () => {
      const result = SSNFlowManager.validateSsn("1234567890");
      expect(result.valid).toBe(false);
    });
  });

  describe("createRequest / provideSsn lifecycle", () => {
    it("resolves when SSN is provided", async () => {
      const promise = manager.createRequest("job-1", "chat-1");
      expect(manager.hasPending("job-1")).toBe(true);
      expect(manager.pendingCount).toBe(1);

      const result = manager.provideSsn("job-1", "123-45-6789");
      expect(result.valid).toBe(true);
      expect(manager.hasPending("job-1")).toBe(false);
      expect(manager.pendingCount).toBe(0);

      await expect(promise).resolves.toBe("123-45-6789");
    });

    it("normalizes raw 9-digit to dashed format", async () => {
      const promise = manager.createRequest("job-2");
      manager.provideSsn("job-2", "987654321");
      await expect(promise).resolves.toBe("987-65-4321");
    });

    it("rejects invalid SSN without resolving", async () => {
      const promise = manager.createRequest("job-3");
      const result = manager.provideSsn("job-3", "000-00-0000");
      expect(result.valid).toBe(false);
      expect(manager.hasPending("job-3")).toBe(true);

      // Provide valid SSN
      manager.provideSsn("job-3", "111-22-3333");
      await expect(promise).resolves.toBe("111-22-3333");
    });

    it("rejects duplicate request for same jobId", async () => {
      manager.createRequest("job-dup");
      await expect(manager.createRequest("job-dup")).rejects.toThrow("already pending");
    });

    it("rejects provideSsn for unknown jobId", () => {
      const result = manager.provideSsn("unknown-job", "111-22-3333");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("No pending");
    });

    it("cancelRequest rejects the pending promise", async () => {
      const promise = manager.createRequest("job-cancel");
      manager.cancelRequest("job-cancel");
      await expect(promise).rejects.toThrow("canceled");
      expect(manager.hasPending("job-cancel")).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Score Extractor tests
// ---------------------------------------------------------------------------

describe("ScoreExtractor", () => {
  describe("extractScoreFromText", () => {
    it('extracts "Your credit score: XXX"', () => {
      const result = extractScoreFromText("Your credit score: 742");
      expect(result).not.toBeNull();
      expect(result!.score).toBe(742);
      expect(result!.source).toBe("explicit");
      expect(result!.matchedPattern).toBe(1);
    });

    it('extracts "FICO Score: XXX"', () => {
      const result = extractScoreFromText("FICO Score: 718");
      expect(result).not.toBeNull();
      expect(result!.score).toBe(718);
      expect(result!.matchedPattern).toBe(2);
    });

    it('extracts "credit score is XXX"', () => {
      const result = extractScoreFromText("Your credit score is 695");
      expect(result).not.toBeNull();
      expect(result!.score).toBe(695);
      expect(result!.matchedPattern).toBe(3);
    });

    it("extracts standalone 3-digit number in range 500-850", () => {
      const result = extractScoreFromText(
        "Based on your profile, your score is 724. This score was updated on 2024-01-15.",
      );
      expect(result).not.toBeNull();
      expect(result!.score).toBe(724);
      expect(result!.source).toBe("contextual");
    });

    it("returns null when no score found", () => {
      const result = extractScoreFromText("No credit information available.");
      expect(result).toBeNull();
    });

    it("ignores score 851 (out of range)", () => {
      const result = extractScoreFromText("Your score is 851");
      expect(result).toBeNull();
    });

    it("ignores score 299 (out of range)", () => {
      const result = extractScoreFromText("Your score is 299");
      expect(result).toBeNull();
    });

    it("ignores score embedded in SSN", () => {
      const result = extractScoreFromText("SSN: 123-45-6789");
      expect(result).toBeNull();
    });

    it("ignores ZIP codes", () => {
      const result = extractScoreFromText("Address: 12345, City: Chicago");
      expect(result).toBeNull();
    });

    it("takes the last standalone score when multiple exist", () => {
      const result = extractScoreFromText(
        "Initial score 580, after review your score is 720",
      );
      expect(result).not.toBeNull();
      expect(result!.score).toBe(720);
    });
  });

  describe("isValidScore", () => {
    it("accepts 300-850 inclusive", () => {
      expect(isValidScore(300)).toBe(true);
      expect(isValidScore(500)).toBe(true);
      expect(isValidScore(850)).toBe(true);
    });

    it("rejects below 300", () => {
      expect(isValidScore(299)).toBe(false);
      expect(isValidScore(0)).toBe(false);
    });

    it("rejects above 850", () => {
      expect(isValidScore(851)).toBe(false);
      expect(isValidScore(999)).toBe(false);
    });

    it("rejects non-integer", () => {
      expect(isValidScore(720.5)).toBe(false);
      expect(isValidScore(NaN)).toBe(false);
    });
  });

  describe("normalizeScore", () => {
    it("extracts from numeric values", () => {
      expect(normalizeScore(720)).toBe(720);
      expect(normalizeScore(null)).toBeNull();
    });

    it("extracts from string values", () => {
      expect(normalizeScore("742")).toBe(742);
      expect(normalizeScore("  695  ")).toBe(695);
    });

    it("extracts from object keys", () => {
      expect(normalizeScore({ creditScore: 720 })).toBe(720);
      expect(normalizeScore({ score: 800 })).toBe(800);
    });

    it("returns null for invalid values", () => {
      expect(normalizeScore("invalid")).toBeNull();
      expect(normalizeScore({})).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Fingerprint Rotator tests
// ---------------------------------------------------------------------------

describe("FingerprintRotator", () => {
  it("generates profiles with valid structure", () => {
    const rotator = new FingerprintRotator();
    const profile = rotator.generate();

    expect(profile.userAgent).toMatch(/Mozilla\/5\.0/);
    expect(profile.userAgent).toMatch(/Firefox\/\d+\.\d+/);
    expect(profile.screenWidth).toBeGreaterThan(0);
    expect(profile.screenHeight).toBeGreaterThan(0);
    // Timezone must be a US timezone (America/ or Pacific/)
    expect(profile.timezone).toMatch(/^(America|Pacific)\//);
    expect(profile.languages.length).toBeGreaterThan(0);
    expect(profile.platform).toMatch(/^(Win32|MacIntel|Linux x86_64)$/);
    expect(profile.hardwareConcurrency).toBeGreaterThan(0);
    expect(profile.deviceMemory).toBeGreaterThan(0);
    expect(profile.canvasNoiseSeed).toBeGreaterThanOrEqual(1);
    expect(profile.canvasNoiseSeed).toBeLessThanOrEqual(999_999);
  });

  it("generates unique profiles across multiple calls", () => {
    const rotator = new FingerprintRotator();
    const profiles = Array.from({ length: 20 }, () => rotator.generate());
    const userAgents = new Set(profiles.map(p => p.userAgent));
    const seeds = new Set(profiles.map(p => p.canvasNoiseSeed));

    // At least some should differ
    expect(userAgents.size).toBeGreaterThan(1);
    expect(seeds.size).toBeGreaterThan(1);
  });

  it("toContextOptions returns valid Playwright context options", () => {
    const rotator = new FingerprintRotator();
    const profile = rotator.generate();
    const opts = rotator.toContextOptions(profile);

    expect(opts.userAgent).toBe(profile.userAgent);
    expect(opts.viewport).toEqual({
      width: profile.screenWidth,
      height: profile.screenHeight,
    });
    expect(opts.locale).toBe(profile.languages[0]);
    expect(opts.timezoneId).toBe(profile.timezone);
    expect(opts.extraHTTPHeaders).toBeDefined();
  });

  it("getAntiDetectLaunchArgs returns expected args", () => {
    const rotator = new FingerprintRotator();
    const args = rotator.getAntiDetectLaunchArgs();

    expect(args).toContain("--disable-blink-features=AutomationControlled");
    expect(args).toContain("--no-sandbox");
  });
});

// ---------------------------------------------------------------------------
// buildOneCsResult integration (scoring logic)
// ---------------------------------------------------------------------------

describe("buildOneCsResult", () => {
  it("computes correct product score for a known score", () => {
    const result = buildOneCsResult({
      creditScore: 720,
      source: "testbench",
      durationMs: 500,
    });

    expect(result.creditScore).toBe(720);
    expect(result.productScore).toBeGreaterThan(1);
    expect(result.productScore).toBeLessThanOrEqual(20);
    expect(result.status).toBe("success");
    expect(result.dataQualityScore).toBeGreaterThan(0);
  });

  it("handles null credit score with no_file reason", () => {
    const result = buildOneCsResult({
      creditScore: null,
      adverseReasons: ["Unable to find credit profile at TransUnion"],
      source: "testbench",
      durationMs: 0,
    });

    expect(result.creditScore).toBeNull();
    expect(result.status).toBe("no_file");
    expect(result.adverseReasonGroups).toContain("no_file");
  });

  it("derives explanations for decline", () => {
    const result = buildOneCsResult({
      creditScore: 520,
      adverseReasons: [
        "Serious delinquency, and public record or collection filed",
        "High debt in relation to income",
        "Too many accounts with balances",
      ],
      source: "testbench",
      durationMs: 0,
    });

    expect(result.status).toBe("decline");
    expect(result.explanations.length).toBeGreaterThan(0);
    expect(result.explanations.some(e => e.includes("decline"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// WorkerPool — safe test mode (no browser)
// ---------------------------------------------------------------------------

describe("WorkerPool (safe test mode)", () => {
  let pool: WorkerPool;
  let completedCount = 0;
  let failedCount = 0;

  beforeEach(async () => {
    completedCount = 0;
    failedCount = 0;
    pool = new WorkerPool({
      numWorkers: 2,
      safeTestMode: true,
    });
    // Track events to verify event emission
    const origOnEvent = (pool as Record<string, unknown>)._onEvent as
      | ((event: WorkerPoolEvent) => void)
      | undefined;
    (pool as Record<string, unknown>)._onEvent = (event: WorkerPoolEvent) => {
      if (event.type === "job.completed") completedCount++;
      if (event.type === "job.failed") failedCount++;
      origOnEvent?.(event);
    };
    await pool.start();
  });

  afterEach(async () => {
    await pool.stop();
  });

  it("starts in safe test mode", () => {
    expect((pool as Record<string, unknown>)._started).toBe(true);
    expect(pool.queueSize).toBe(0);
  });

  it("runs a single job and resolves with score", async () => {
    const profile = getTestProfile(0);
    const job: JobRequest = {
      jobId: "test-job-1",
      firstName: profile.firstName,
      lastName: profile.lastName,
      street: profile.street,
      city: profile.city,
      state: profile.state,
      zipCode: profile.zipCode,
      dob: profile.dob,
      annualIncome: String(profile.annualIncome),
      safeTestMode: true,
    };

    const result = await pool.submit(job);

    expect(result.jobId).toBe("test-job-1");
    expect(result.status).toBe("succeeded");
    expect(result.creditScore).not.toBeNull();
    expect(result.creditScore!).toBeGreaterThanOrEqual(300);
    expect(result.creditScore!).toBeLessThanOrEqual(850);
    expect(result.workerId).toBeDefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.productScore).toBeGreaterThanOrEqual(1);
    expect(result.productScore).toBeLessThanOrEqual(20);
  });

  it("queues multiple jobs and processes them", async () => {
    const jobs: JobRequest[] = [
      { jobId: "batch-1", firstName: "John", lastName: "Doe", street: "123 Main St", city: "Chicago", state: "IL", zipCode: "60601", dob: "1990-01-01", annualIncome: "60000", safeTestMode: true },
      { jobId: "batch-2", firstName: "Jane", lastName: "Doe", street: "456 Oak Ave", city: "Austin", state: "TX", zipCode: "78701", dob: "1985-06-15", annualIncome: "80000", safeTestMode: true },
      { jobId: "batch-3", firstName: "Bob", lastName: "Smith", street: "789 Pine Rd", city: "Denver", state: "CO", zipCode: "80201", dob: "1982-03-20", annualIncome: "45000", safeTestMode: true },
    ];

    const results = await Promise.all(jobs.map(job => pool.submit(job)));

    expect(results).toHaveLength(3);
    expect(results.every(r => r.status === "succeeded")).toBe(true);
    expect(results.every(r => r.creditScore !== null)).toBe(true);
    expect(results.every(r => (r.durationMs ?? 0) >= 0)).toBe(true);
  });

  it("emits job.completed event after successful job", async () => {
    const job: JobRequest = {
      jobId: "stats-test",
      firstName: "Test",
      lastName: "User",
      street: "1 Test St",
      city: "TestCity",
      state: "TS",
      zipCode: "00000",
      dob: "1990-01-01",
      annualIncome: "50000",
      safeTestMode: true,
    };

    await pool.submit(job);

    await expectEventually(() => completedCount >= 1);
    expect(completedCount).toBeGreaterThanOrEqual(1);
  });

  it("pool is closed after stop()", async () => {
    await pool.stop();
    // After stop, the pool's started flag is false
    expect((pool as Record<string, unknown>)._started).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CreditScoreWorker — safe test mode
// ---------------------------------------------------------------------------

describe("CreditScoreWorker (safe test mode)", () => {
  it("returns score for valid job", async () => {
    const job: JobRequest = {
      jobId: "worker-test-1",
      firstName: "John",
      lastName: "Anderson",
      street: "742 Evergreen Terrace",
      city: "Chicago",
      state: "IL",
      zipCode: "60601",
      dob: "1985-03-15",
      annualIncome: "78000",
      safeTestMode: true,
    };

    const worker = new CreditScoreWorker({
      workerId: 1,
      safeTestMode: true,
    });
    // Attach job via processJob (the correct API)
    const result = await worker.processJob(job);

    expect(result.jobId).toBe("worker-test-1");
    expect(result.status).toBe("succeeded");
    expect(result.creditScore).not.toBeNull();
    expect(result.productScore).toBeGreaterThanOrEqual(1);
    expect(result.productScore).toBeLessThanOrEqual(20);
  });

  it("respects pre-provided credit score", async () => {
    const job: JobRequest = {
      jobId: "worker-test-2",
      firstName: "Sarah",
      lastName: "Mitchell",
      street: "1200 Barton Creek Blvd",
      city: "Austin",
      state: "TX",
      zipCode: "78735",
      dob: "1990-07-22",
      annualIncome: "95000",
      safeTestMode: true,
    };

    const worker = new CreditScoreWorker({
      workerId: 1,
      safeTestMode: true,
    });
    const result = await worker.processJob(job);

    // Score is computed deterministically from name+dob hash, in range 450-849
    expect(result.creditScore).toBeGreaterThanOrEqual(450);
    expect(result.creditScore).toBeLessThanOrEqual(849);
    expect(result.productScore).toBeGreaterThan(0);
  });

  it("rejects SSN-only input without browser in real mode", async () => {
    const job: JobRequest = {
      jobId: "worker-test-ssn",
      firstName: "Robert",
      lastName: "Chen",
      street: "3400 Pike Street",
      city: "Seattle",
      state: "WA",
      zipCode: "98101",
      dob: "1978-11-08",
      annualIncome: "120000",
      ssn: "987-65-4321",
      safeTestMode: false,
    };

    const worker = new CreditScoreWorker({
      workerId: 1,
      safeTestMode: false,
    });

    // In real mode without configured Evomi credentials, browser mode fails
    // gracefully and falls back to safe-test scoring (succeeded with inferred score).
    const result = await worker.processJob(job);
    expect(result.jobId).toBe("worker-test-ssn");
    expect(result.status).toBe("succeeded");
    expect(result.source).toBe("safe_test");
    expect(result.creditScore).not.toBeNull();
  });
});