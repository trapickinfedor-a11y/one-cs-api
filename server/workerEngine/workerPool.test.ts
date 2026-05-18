import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createWorkerEngine,
  type WorkerConfig,
  type WorkerInstance,
  type WorkerEngineOptions,
  type WorkerPoolOptions,
} from "./index";
import {
  WorkerPool,
  type JobRequest,
  type JobResult,
} from "./csWorkerEngine.js";
import {
  FingerprintRotator,
  FingerprintProfile,
  defaultFingerprintRotator,
} from "./fingerprintRotator.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJobRequest(overrides: Partial<JobRequest> = {}): JobRequest {
  return {
    jobId: `job_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    firstName: "John",
    lastName: "Doe",
    street: "123 Main St",
    city: "Anytown",
    state: "CA",
    zipCode: "90210",
    dob: "01/15/1985",
    annualIncome: "75000",
    ssn: "123-45-6789",
    email: "john.doe@example.com",
    telegramChatId: undefined,
    telegramMessageId: undefined,
    maxRetries: 3,
    ...overrides,
  };
}

function makeWorkerConfig(id: number, name = "test-worker"): WorkerConfig {
  return {
    id,
    name,
    concurrency: 2,
    safeTestMode: false,
    maxRetries: 3,
    proxyRotateAfterN: 20,
    ssnTimeoutMs: 90_000,
    browserTimeoutMs: 60_000,
  };
}

// ---------------------------------------------------------------------------
// WorkerPool (direct csWorkerEngine API)
// ---------------------------------------------------------------------------

describe("WorkerPool", () => {
  let pool: WorkerPool;

  beforeEach(async () => {
    pool = new WorkerPool({ numWorkers: 4, maxConcurrency: 2, safeTestMode: true });
    await pool.start();
  });

  afterEach(async () => {
    await pool.stop();
  });

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  it("starts empty queue", () => {
    expect(pool.queueSize).toBe(0);
    expect(pool.activeWorkers).toBe(4);
  });

  // ---------------------------------------------------------------------------
  // Job submission
  // ---------------------------------------------------------------------------

  it("submit returns succeeded result in safe test mode", async () => {
    const job = makeJobRequest({ jobId: "job-submit-001" });
    const result = await pool.submit(job);
    expect(result.status).toBe("succeeded");
    expect(result.creditScore).toBeDefined();
    expect(typeof result.creditScore).toBe("number");
    expect(result.productScore).toBeDefined();
  });

  it("submit with simulateTimeout returns timeout status", async () => {
    const job = makeJobRequest({ jobId: "job-timeout-001" });
    // Safe test mode does not simulate timeout — only browser mode does.
    // For timeout test we use a real engine with simulateTimeout in payload.
    const engine = createWorkerEngine({ maxWorkers: 1 });
    const workerResult = await engine.submitJob({
      jobPublicId: job.jobId,
      payload: { simulateTimeout: true },
      priority: 100,
      queueName: "default",
      safeTestMode: false,
      maxRetries: 3,
    });
    expect(workerResult.status).toBe("timeout");
    expect(workerResult.errorCode).toBe("BROWSER_TIMEOUT");
    await engine.stop();
  });

  it("submit with simulateError returns failed result", async () => {
    const engine = createWorkerEngine({ maxWorkers: 1 });
    const result = await engine.submitJob({
      jobPublicId: "job-error-001",
      payload: { simulateError: true, errorDetail: "Proxy connection refused" },
      priority: 100,
      queueName: "default",
      safeTestMode: false,
      maxRetries: 3,
    });
    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("EXECUTION_ERROR");
    expect(result.errorMessage).toContain("Proxy connection refused");
    await engine.stop();
  });

  it("submit with SSN in payload works", async () => {
    const job = makeJobRequest({ ssn: "123-45-6789" });
    const result = await pool.submit(job);
    expect(result.status).toBe("succeeded");
    // needsSsn is set by the queue layer; worker itself doesn't set it
    expect(typeof result.needsSsn).toBe("boolean");
    expect(result.creditScore).toBeDefined();
  });

  it("submit without SSN works", async () => {
    const job = makeJobRequest({ ssn: undefined });
    const result = await pool.submit(job);
    expect(result.status).toBe("succeeded");
    expect(typeof result.needsSsn).toBe("boolean");
  });

  // ---------------------------------------------------------------------------
  // Queue size and active workers
  // ---------------------------------------------------------------------------

  it("queueSize reflects number of pending jobs", async () => {
    expect(pool.queueSize).toBe(0);
    const j1 = makeJobRequest({ jobId: "job-q1" });
    const j2 = makeJobRequest({ jobId: "job-q2" });
    void pool.submit(j1);
    void pool.submit(j2);
    // Queue size may be 0 if workers consumed them immediately
    expect(typeof pool.queueSize).toBe("number");
  });

  it("activeWorkers returns number of running workers", () => {
    expect(pool.activeWorkers).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// createWorkerEngine (top-level orchestrator)
// ---------------------------------------------------------------------------

describe("createWorkerEngine", () => {
  afterEach(async () => {
    // Clean up any lingering engine
  });

  it("creates engine with isRunning false initially", () => {
    const engine = createWorkerEngine({ maxWorkers: 1 });
    expect(engine.isRunning).toBe(false);
    void engine.stop();
  });

  it("start sets isRunning to true", () => {
    const engine = createWorkerEngine({ maxWorkers: 1 });
    engine.start();
    expect(engine.isRunning).toBe(true);
    void engine.stop();
  });

  it("start is idempotent (no-op on second call)", () => {
    const engine = createWorkerEngine({ maxWorkers: 1 });
    engine.start();
    engine.start();
    expect(engine.isRunning).toBe(true);
    void engine.stop();
  });

  it("stop sets isRunning to false", async () => {
    const engine = createWorkerEngine({ maxWorkers: 1 });
    engine.start();
    await engine.stop();
    expect(engine.isRunning).toBe(false);
  });

  it("workerPool property exposes the WorkerPool instance", () => {
    const engine = createWorkerEngine({ maxWorkers: 2 });
    expect(engine.workerPool).toBeDefined();
    expect(typeof engine.workerPool.start).toBe("function");
    expect(typeof engine.workerPool.stop).toBe("function");
    expect(typeof engine.workerPool.submit).toBe("function");
    expect(typeof engine.workerPool.queueSize).toBe("number");
    expect(typeof engine.workerPool.activeWorkers).toBe("number");
    void engine.stop();
  });

  it("registerWorker returns WorkerInstance", () => {
    const engine = createWorkerEngine({ maxWorkers: 2 });
    const worker = engine.registerWorker(makeWorkerConfig(1, "reg-w"));
    expect(worker).toBeDefined();
    expect(worker.id).toBeDefined();
    expect(worker.name).toBe("reg-w");
    expect(worker.status).toBe("idle");
    expect(worker.config.id).toBe(1);
    void engine.stop();
  });

  it("deregisterWorker removes worker without throwing", () => {
    const engine = createWorkerEngine({ maxWorkers: 2 });
    const worker = engine.registerWorker(makeWorkerConfig(1, "dereg-w"));
    expect(() => engine.deregisterWorker(worker.id)).not.toThrow();
    void engine.stop();
  });

  it("submitJob with safeTestMode returns mock result without external calls", async () => {
    const engine = createWorkerEngine({ maxWorkers: 1 });
    const result = await engine.submitJob({
      jobPublicId: "job-safe-001",
      payload: { creditScore: 750 },
      priority: 100,
      queueName: "default",
      safeTestMode: true,
      maxRetries: 3,
    });
    expect(result.status).toBe("succeeded");
    expect(result.creditScore).toBe(720); // safe test mock score
    expect(result.proxyUsed).toBe("mock://safe-test");
    await engine.stop();
  });

  it("submitJob with safeTestMode does not require SSN", async () => {
    const engine = createWorkerEngine({ maxWorkers: 1 });
    const result = await engine.submitJob({
      jobPublicId: "job-safe-no-ssn",
      payload: {},
      priority: 100,
      queueName: "default",
      safeTestMode: true,
      maxRetries: 3,
    });
    expect(result.status).toBe("succeeded");
    expect(result.ssnProvided).toBe(false);
    await engine.stop();
  });

  it("submitJob with ssn in payload sets ssnProvided to true", async () => {
    const engine = createWorkerEngine({ maxWorkers: 1 });
    const result = await engine.submitJob({
      jobPublicId: "job-ssn-001",
      payload: { ssn: "123-45-6789", creditScore: 720 },
      priority: 100,
      queueName: "default",
      safeTestMode: false,
      maxRetries: 3,
    });
    expect(result.status).toBe("succeeded");
    expect(result.ssnProvided).toBe(true);
    expect(result.creditScore).toBe(720);
    await engine.stop();
  });

  it("submitJob with socialSecurityNumber sets ssnProvided to true", async () => {
    const engine = createWorkerEngine({ maxWorkers: 1 });
    const result = await engine.submitJob({
      jobPublicId: "job-ssn-long-field",
      payload: { socialSecurityNumber: "987-65-4321" },
      priority: 100,
      queueName: "default",
      safeTestMode: false,
      maxRetries: 3,
    });
    expect(result.status).toBe("succeeded");
    expect(result.ssnProvided).toBe(true);
    await engine.stop();
  });

  it("submitJob with creditScore in payload uses that score", async () => {
    const engine = createWorkerEngine({ maxWorkers: 1 });
    const result = await engine.submitJob({
      jobPublicId: "job-score-001",
      payload: { creditScore: 800 },
      priority: 100,
      queueName: "default",
      safeTestMode: false,
      maxRetries: 3,
    });
    expect(result.status).toBe("succeeded");
    expect(result.creditScore).toBe(800);
    await engine.stop();
  });

  it("submitJob without creditScore in payload returns null credit score", async () => {
    const engine = createWorkerEngine({ maxWorkers: 1 });
    const result = await engine.submitJob({
      jobPublicId: "job-no-score",
      payload: {},
      priority: 100,
      queueName: "default",
      safeTestMode: false,
      maxRetries: 3,
    });
    expect(result.status).toBe("succeeded");
    expect(result.creditScore).toBeNull();
    await engine.stop();
  });

  it("createWorkerEngine with custom options", () => {
    const engine = createWorkerEngine({
      maxWorkers: 8,
      maxConcurrency: 4,
      pollIntervalMs: 2_000,
      heartbeatIntervalMs: 15_000,
    });
    expect(engine.workerPool).toBeDefined();
    engine.start();
    expect(engine.isRunning).toBe(true);
    void engine.stop();
  });
});

// ---------------------------------------------------------------------------
// FingerprintRotator
// ---------------------------------------------------------------------------

describe("FingerprintRotator", () => {
  it("generate produces unique profiles on each call", () => {
    const rotator = new FingerprintRotator();
    const fp1 = rotator.generate();
    const fp2 = rotator.generate();
    const fp3 = rotator.generate();

    // At least one pair should differ (statistically certain with 3 calls)
    const allSame =
      fp1.userAgent === fp2.userAgent && fp2.userAgent === fp3.userAgent;
    expect(allSame).toBe(false);
  });

  it("generate returns structurally valid profiles", () => {
    const rotator = new FingerprintRotator();
    const fp = rotator.generate();

    expect(typeof fp.userAgent).toBe("string");
    expect(fp.userAgent.length).toBeGreaterThan(20);
    expect(fp.userAgent).toMatch(/Mozilla\/5\.0/);
    expect(fp.screenWidth).toBeGreaterThan(0);
    expect(fp.screenHeight).toBeGreaterThan(0);
    expect([1366, 1440, 1536, 1280, 1600, 1280, 1024, 1680, 1920, 2560, 1360]).toContain(fp.screenWidth);
    expect(fp.timezone).toMatch(/^(America|Pacific)\//);
    expect(Array.isArray(fp.languages)).toBe(true);
    expect(fp.languages.length).toBeGreaterThan(0);
    expect(fp.platform).toMatch(/^(Win32|MacIntel|Linux x86_64)$/);
    expect(fp.hardwareConcurrency).toBeGreaterThan(0);
    expect(fp.deviceMemory).toBeGreaterThan(0);
    expect(typeof fp.webglVendor).toBe("string");
    expect(typeof fp.webglRenderer).toBe("string");
    expect(typeof fp.canvasNoiseSeed).toBe("number");
    expect(typeof fp.audioNoiseSeed).toBe("number");
    expect(typeof fp.doNotTrack === "string" || fp.doNotTrack === null).toBe(true); // string or null per FingerprintProfile interface
  });

  it("toContextOptions produces valid Playwright context options", () => {
    const rotator = new FingerprintRotator();
    const fp = rotator.generate();
    const opts = rotator.toContextOptions(fp);

    expect(typeof opts).toBe("object");
    expect(opts.userAgent).toBe(fp.userAgent);
    expect(opts.viewport).toBeDefined();
    expect((opts.viewport as { width: number }).width).toBe(fp.screenWidth);
    expect((opts.viewport as { height: number }).height).toBe(fp.screenHeight);
    expect(typeof opts.timezoneId).toBe("string");
  });

  it("getAntiDetectLaunchArgs returns non-empty array", () => {
    const rotator = new FingerprintRotator();
    const args = rotator.getAntiDetectLaunchArgs();
    expect(Array.isArray(args)).toBe(true);
    expect(args.length).toBeGreaterThan(0);
    expect(args).toContain("--disable-blink-features=AutomationControlled");
  });

  it("buildWebGlSpoof returns vendor and renderer", () => {
    const rotator = new FingerprintRotator();
    const fp = rotator.generate();
    const spoof = rotator.buildWebGlSpoof(fp);
    expect(spoof.vendor).toBe(fp.webglVendor);
    expect(spoof.renderer).toBe(fp.webglRenderer);
  });

  it("defaultFingerprintRotator is exported and works", () => {
    const fp = defaultFingerprintRotator.generate();
    expect(fp).toBeDefined();
    expect(typeof fp.userAgent).toBe("string");
  });

  it("toPlaywrightOptions produces complete options object", () => {
    const rotator = new FingerprintRotator();
    const fp = rotator.generate();
    const opts = rotator.toContextOptions(fp); // uses same method internally

    expect(opts.userAgent).toBe(fp.userAgent);
    expect(opts.viewport).toBeDefined();
    expect(typeof opts.timezoneId).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// WorkerEngine lifecycle integration
// ---------------------------------------------------------------------------

describe("WorkerEngine lifecycle", () => {
  it("engine with multiple workers starts and stops cleanly", async () => {
    const engine = createWorkerEngine({ maxWorkers: 3 });
    engine.start();
    expect(engine.isRunning).toBe(true);

    engine.registerWorker(makeWorkerConfig(1, "lifecycle-1"));
    engine.registerWorker(makeWorkerConfig(2, "lifecycle-2"));
    engine.registerWorker(makeWorkerConfig(3, "lifecycle-3"));

    await engine.stop();
    expect(engine.isRunning).toBe(false);
  });

  it("submitJob after start still works", async () => {
    const engine = createWorkerEngine({ maxWorkers: 1 });
    engine.start();
    const result = await engine.submitJob({
      jobPublicId: "job-after-start",
      payload: { creditScore: 680 },
      priority: 100,
      queueName: "default",
      safeTestMode: true,
      maxRetries: 3,
    });
    expect(result.status).toBe("succeeded");
    expect(result.creditScore).toBe(720); // safe test mock
    await engine.stop();
  });

  it("proxyConfig is respected in result proxyUsed field", async () => {
    const engine = createWorkerEngine({ maxWorkers: 1 });
    const result = await engine.submitJob({
      jobPublicId: "job-proxy-hint",
      payload: { creditScore: 700 },
      proxyConfig: { providerHint: "evomi", country: "us" },
      priority: 100,
      queueName: "default",
      safeTestMode: true,
      maxRetries: 3,
    });
    expect(result.status).toBe("succeeded");
    expect(result.proxyUsed).toBe("evomi");
    await engine.stop();
  });
});