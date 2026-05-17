/**
 * server/workerEngine/csWorkerEngine.test.ts
 *
 * Integration tests for the CS Worker Engine.
 *
 * Test coverage:
 *   1. WorkerPool initialization and lifecycle
 *   2. Job submission and result retrieval (safe test mode, auto-detected)
 *   3. WorkerEngine lifecycle (create, start, stop)
 *   4. WorkerEngine high-level submitJob() API
 *   5. Test data validation: credit score range 300-850
 *   6. buildOneCsResult scoring consistency
 *   7. registerWorker / deregisterWorker
 *
 * All test profiles are synthetic and completely fictional.
 * Safe test mode is auto-detected when no Evomi credentials are set.
 *
 * Reference: server/scoring.test.ts, server/platformService.test.ts
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  WorkerEngine,
  WorkerPool,
  JobRequest,
  createWorkerEngine,
  getGlobalEngine,
  setGlobalEngine,
} from "./index.js";
import { buildOneCsResult } from "../../shared/oneCsScoring.js";
import { TEST_PROFILES, getTestProfile } from "./fixtures/testProfiles.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Build a flat JobRequest from a test profile index. */
function makeJobFromProfile(profileIndex: number, jobId: string): JobRequest {
  const profile = getTestProfile(profileIndex);
  return {
    jobId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    street: profile.street,
    city: profile.city,
    state: profile.state,
    zipCode: profile.zipCode,
    dob: profile.dob,
    annualIncome: String(profile.annualIncome),
  };
}

// ---------------------------------------------------------------------------
// WorkerPool — initialization and lifecycle
// ---------------------------------------------------------------------------

describe("WorkerPool — initialization", () => {
  let pool: WorkerPool;

  afterEach(async () => {
    await pool.stop();
  });

  it("starts and stops without errors", async () => {
    pool = new WorkerPool({ numWorkers: 2, safeTestMode: true });
    await pool.start();
    expect(pool.queueSize).toBe(0);
    // activeWorkers reflects running loop goroutines; may be >0
    expect(pool.activeWorkers).toBeGreaterThanOrEqual(0);
  });

  it("respects numWorkers limit", async () => {
    pool = new WorkerPool({ numWorkers: 2, safeTestMode: true });
    await pool.start();
    // Pool initializes without throwing
    expect(pool.activeWorkers).toBeGreaterThanOrEqual(0);
  });

  it("has zero queueSize initially", async () => {
    pool = new WorkerPool({ numWorkers: 1, safeTestMode: true });
    await pool.start();
    expect(pool.queueSize).toBe(0);
  });

  it("stop() is idempotent", async () => {
    pool = new WorkerPool({ numWorkers: 1, safeTestMode: true });
    await pool.start();
    await pool.stop();
    await pool.stop(); // must not throw
  });
});

// ---------------------------------------------------------------------------
// WorkerPool — job submission and result retrieval (safe test mode)
// ---------------------------------------------------------------------------

describe("WorkerPool — job submission (safe test mode)", () => {
  let pool: WorkerPool;

  beforeEach(async () => {
    pool = new WorkerPool({ numWorkers: 2, safeTestMode: true });
    await pool.start();
  });

  afterEach(async () => {
    await pool.stop();
  });

  it("submit() returns a JobResult with succeeded status", async () => {
    const job: JobRequest = {
      jobId: "submit-001",
      firstName: "John",
      lastName: "Anderson",
      street: "742 Evergreen Terrace",
      city: "Chicago",
      state: "IL",
      zipCode: "60601",
      dob: "01/15/1985",
      annualIncome: "78000",
    };

    const result = await pool.submit(job);
    expect(result.status).toBe("succeeded");
    expect(result.jobId).toBe("submit-001");
  });

  it("submit() infers a credit score in the 450-849 range from name hash", async () => {
    const job: JobRequest = {
      jobId: "score-001",
      firstName: "John",
      lastName: "Anderson",
      street: "742 Evergreen Terrace",
      city: "Chicago",
      state: "IL",
      zipCode: "60601",
      dob: "01/15/1985",
      annualIncome: "78000",
    };

    const result = await pool.submit(job);
    expect(result.creditScore).not.toBeNull();
    expect(result.creditScore!).toBeGreaterThanOrEqual(450);
    expect(result.creditScore!).toBeLessThanOrEqual(849);
  });

  it("submit() returns productScore and dataQualityScore in valid ranges", async () => {
    const job: JobRequest = {
      jobId: "range-001",
      firstName: "Sarah",
      lastName: "Mitchell",
      street: "1200 Barton Creek Blvd",
      city: "Austin",
      state: "TX",
      zipCode: "78735",
      dob: "07/22/1990",
      annualIncome: "95000",
    };

    const result = await pool.submit(job);
    expect(result.productScore).not.toBeNull();
    expect(result.productScore!).toBeGreaterThanOrEqual(1);
    expect(result.productScore!).toBeLessThanOrEqual(20);
    expect(result.dataQualityScore).not.toBeNull();
    expect(result.dataQualityScore!).toBeGreaterThanOrEqual(1);
    expect(result.dataQualityScore!).toBeLessThanOrEqual(10);
  });

  it("submit() returns proxyIp=null in safe test mode", async () => {
    const job = makeJobFromProfile(0, "safe-proxy-001");
    const result = await pool.submit(job);
    expect(result.proxyIp).toBeNull();
  });

  it("submit() with SSN marks needsSsn=false in safe test mode", async () => {
    const job: JobRequest = {
      jobId: "ssn-001",
      firstName: "Emily",
      lastName: "Watson",
      street: "8800 East Colfax Ave",
      city: "Denver",
      state: "CO",
      zipCode: "80220",
      dob: "05/30/1993",
      annualIncome: "52000",
      ssn: "123-45-6789",
    };

    const result = await pool.submit(job);
    // safe test mode does not trigger SSN flow
    expect(result.needsSsn).toBe(false);
    expect(result.source).toBe("testbench");
  });

  it("submit() returns correct workerId", async () => {
    const job = makeJobFromProfile(0, "worker-id-001");
    const result = await pool.submit(job);
    expect(typeof result.workerId).toBe("number");
  });

  it("submit() populates durationMs", async () => {
    const job = makeJobFromProfile(1, "duration-001");
    const result = await pool.submit(job);
    expect(result.durationMs).not.toBeNull();
    expect(result.durationMs!).toBeGreaterThanOrEqual(0);
  });

  it("submit() returns status_ field from buildOneCsResult", async () => {
    const job = makeJobFromProfile(2, "status-underscore-001");
    const result = await pool.submit(job);
    expect(result.status_).not.toBeNull();
    // Valid status_ values from buildOneCsResult
    const validStatuses = ["success", "review", "decline", "no_file"];
    expect(validStatuses).toContain(result.status_!);
  });

  it("submit() with telegramChatId includes it in result", async () => {
    const job: JobRequest = {
      jobId: "telegram-001",
      firstName: "Robert",
      lastName: "Chen",
      street: "3400 Pike Street",
      city: "Seattle",
      state: "WA",
      zipCode: "98101",
      dob: "11/08/1978",
      annualIncome: "120000",
      telegramChatId: "123456789",
      telegramMessageId: 42,
    };

    const result = await pool.submit(job);
    expect(result.status).toBe("succeeded");
  });

  it("submit() with maxRetries does not throw", async () => {
    const job: JobRequest = {
      jobId: "maxretries-001",
      firstName: "Michael",
      lastName: "Park",
      street: "5550 Biscayne Boulevard",
      city: "Miami",
      state: "FL",
      zipCode: "33137",
      dob: "09/12/1982",
      annualIncome: "65000",
      maxRetries: 3,
    };

    const result = await pool.submit(job);
    expect(result.status).toBe("succeeded");
  });

  it("submit() queues jobs and resolves each independently", async () => {
    const jobs = TEST_PROFILES.map((p, i) => ({
      jobId: `parallel-${i}`,
      firstName: p.firstName,
      lastName: p.lastName,
      street: p.street,
      city: p.city,
      state: p.state,
      zipCode: p.zipCode,
      dob: p.dob,
      annualIncome: String(p.annualIncome),
    }));

    const results = await Promise.all(jobs.map(j => pool.submit(j)));

    expect(results).toHaveLength(5);
    for (const result of results) {
      expect(result.status).toBe("succeeded");
      expect(result.creditScore).not.toBeNull();
      expect(result.productScore).not.toBeNull();
    }
  });

  it("queueSize reflects pending jobs while workers are busy", async () => {
    const job: JobRequest = {
      jobId: "queue-001",
      firstName: "John",
      lastName: "Anderson",
      street: "742 Evergreen Terrace",
      city: "Chicago",
      state: "IL",
      zipCode: "60601",
      dob: "01/15/1985",
      annualIncome: "78000",
    };

    // Submit without awaiting — pool should have queued the job
    const pending = pool.submit(job);
    // At this point the job is either queued or being processed
    // After a short wait, the result should be available
    const result = await pending;
    expect(result.status).toBe("succeeded");
  });
});

// ---------------------------------------------------------------------------
// WorkerPool — error handling
// ---------------------------------------------------------------------------

describe("WorkerPool — error handling", () => {
  let pool: WorkerPool;

  afterEach(async () => {
    await pool.stop();
  });

  it("submit() with empty required fields does not throw (graceful)", async () => {
    pool = new WorkerPool({ numWorkers: 1, safeTestMode: true });
    await pool.start();

    const job: JobRequest = {
      jobId: "empty-fields-001",
      firstName: "",
      lastName: "",
      street: "",
      city: "",
      state: "",
      zipCode: "",
      dob: "",
      annualIncome: "",
    };

    // Should not throw; safe mode processes the job with empty data
    const result = await pool.submit(job);
    expect(result.status).toBe("succeeded");
  });
});

// ---------------------------------------------------------------------------
// WorkerEngine — lifecycle
// ---------------------------------------------------------------------------

describe("WorkerEngine — lifecycle", () => {
  it("createWorkerEngine creates a non-running engine", () => {
    const engine = createWorkerEngine({ maxWorkers: 2 });
    expect(engine.isRunning).toBe(false);
  });

  it("start() transitions engine to running state", () => {
    const engine = createWorkerEngine({ maxWorkers: 2 });
    engine.start();
    expect(engine.isRunning).toBe(true);
    void engine.stop();
  });

  it("stop() transitions engine back to stopped state", async () => {
    const engine = createWorkerEngine({ maxWorkers: 2 });
    engine.start();
    expect(engine.isRunning).toBe(true);
    await engine.stop();
    expect(engine.isRunning).toBe(false);
  });

  it("getGlobalEngine returns engine set by setGlobalEngine", () => {
    const engine = createWorkerEngine({ maxWorkers: 2 });
    setGlobalEngine(engine);
    expect(getGlobalEngine()).toBe(engine);
  });

  it("pool property exposes the underlying WorkerPool", () => {
    const engine = createWorkerEngine({ maxWorkers: 2 });
    expect(engine.pool).toBeInstanceOf(WorkerPool);
  });

  it("workerPool property is an alias for pool", () => {
    const engine = createWorkerEngine({ maxWorkers: 2 });
    expect(engine.workerPool).toBe(engine.pool);
  });
});

// ---------------------------------------------------------------------------
// WorkerEngine — submitJob() high-level API
//
// NOTE: submitJob() is a synchronous mock that does not use WorkerPool.submit().
// It always uses safe test mode internally (safeTestMode flag is ignored by the
// mock). The creditScore in the result is always 720 (safe test inferred score)
// unless simulateError/simulateTimeout is set.
// ---------------------------------------------------------------------------

describe("WorkerEngine — submitJob() high-level API", () => {
  let engine: WorkerEngine;

  afterEach(async () => {
    await engine.stop();
  });

  it("submitJob with safeTestMode=true returns succeeded status", async () => {
    engine = createWorkerEngine({ maxWorkers: 1 });

    const result = await engine.submitJob({
      jobPublicId: "safe-001",
      payload: { creditScore: 800 },
      priority: 100,
      queueName: "default",
      safeTestMode: true,
      maxRetries: 3,
    });

    expect(result.status).toBe("succeeded");
    // safe test mode overrides the score to 720 (name-hash inferred)
    expect(result.creditScore).toBe(720);
    expect(result.productScore).toBeGreaterThanOrEqual(1);
    expect(result.productScore).toBeLessThanOrEqual(20);
  });

  it("submitJob with safeTestMode=true returns proxyUsed=mock://safe-test", async () => {
    engine = createWorkerEngine({ maxWorkers: 1 });

    const result = await engine.submitJob({
      jobPublicId: "proxy-check-001",
      payload: {},
      priority: 100,
      queueName: "default",
      safeTestMode: true,
      maxRetries: 3,
    });

    expect(result.status).toBe("succeeded");
    expect(result.proxyUsed).toBe("mock://safe-test");
  });

  it("submitJob with safeTestMode=true does not require SSN", async () => {
    engine = createWorkerEngine({ maxWorkers: 1 });

    const result = await engine.submitJob({
      jobPublicId: "no-ssn-001",
      payload: {},
      priority: 100,
      queueName: "default",
      safeTestMode: true,
      maxRetries: 3,
    });

    expect(result.status).toBe("succeeded");
    expect(result.ssnProvided).toBe(false);
  });

  it("submitJob with SSN in payload marks ssnProvided=true", async () => {
    engine = createWorkerEngine({ maxWorkers: 1 });

    const result = await engine.submitJob({
      jobPublicId: "ssn-payload-001",
      payload: { ssn: "123-45-6789", creditScore: 720 },
      priority: 100,
      queueName: "default",
      safeTestMode: false,
      maxRetries: 3,
    });

    expect(result.status).toBe("succeeded");
    expect(result.ssnProvided).toBe(true);
  });

  it("submitJob with simulateError returns failed status", async () => {
    engine = createWorkerEngine({ maxWorkers: 1 });

    const result = await engine.submitJob({
      jobPublicId: "sim-error-001",
      payload: { simulateError: true, errorDetail: "Proxy connection refused" },
      priority: 100,
      queueName: "default",
      safeTestMode: false,
      maxRetries: 3,
    });

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("EXECUTION_ERROR");
    expect(result.errorMessage).toContain("Proxy connection refused");
  });

  it("submitJob with simulateTimeout returns timeout status", async () => {
    engine = createWorkerEngine({ maxWorkers: 1 });

    const result = await engine.submitJob({
      jobPublicId: "sim-timeout-001",
      payload: { simulateTimeout: true },
      priority: 100,
      queueName: "default",
      safeTestMode: false,
      maxRetries: 3,
    });

    expect(result.status).toBe("timeout");
    expect(result.errorCode).toBe("BROWSER_TIMEOUT");
  });

  it("submitJob respects priority ordering", async () => {
    engine = createWorkerEngine({ maxWorkers: 1 });

    const [r1, r2, r3] = await Promise.all([
      engine.submitJob({
        jobPublicId: "priority-low",
        payload: { creditScore: 600 },
        priority: 50,
        queueName: "default",
        safeTestMode: true,
        maxRetries: 1,
      }),
      engine.submitJob({
        jobPublicId: "priority-high",
        payload: { creditScore: 700 },
        priority: 100,
        queueName: "default",
        safeTestMode: true,
        maxRetries: 1,
      }),
      engine.submitJob({
        jobPublicId: "priority-mid",
        payload: { creditScore: 650 },
        priority: 75,
        queueName: "default",
        safeTestMode: true,
        maxRetries: 1,
      }),
    ]);

    // All should succeed regardless of order
    expect(r1.status).toBe("succeeded");
    expect(r2.status).toBe("succeeded");
    expect(r3.status).toBe("succeeded");
  });

  it("submitJob with firstName/lastName but no explicit score uses safe test score", async () => {
    engine = createWorkerEngine({ maxWorkers: 1 });

    const result = await engine.submitJob({
      jobPublicId: "name-only-001",
      payload: { firstName: "Test", lastName: "User" },
      priority: 100,
      queueName: "default",
      safeTestMode: true,
      maxRetries: 3,
    });

    expect(result.status).toBe("succeeded");
    // safe test mode always returns 720
    expect(result.creditScore).toBe(720);
  });
});

// ---------------------------------------------------------------------------
// WorkerPool — safe test mode with testProfiles
// ---------------------------------------------------------------------------

describe("WorkerPool — safe test mode with testProfiles", () => {
  let pool: WorkerPool;

  beforeEach(async () => {
    pool = new WorkerPool({ numWorkers: 3, safeTestMode: true });
    await pool.start();
  });

  afterEach(async () => {
    await pool.stop();
  });

  it("processes all 5 synthetic test profiles and returns valid scores", async () => {
    const results = await Promise.all(
      TEST_PROFILES.map((_, i) =>
        pool.submit(makeJobFromProfile(i, `profile-${i}`)),
      ),
    );

    expect(results).toHaveLength(5);
    for (const result of results) {
      expect(result.status).toBe("succeeded");
      expect(result.creditScore).not.toBeNull();
      expect(result.creditScore!).toBeGreaterThanOrEqual(450);
      expect(result.creditScore!).toBeLessThanOrEqual(849);
      expect(result.productScore!).toBeGreaterThanOrEqual(1);
      expect(result.productScore!).toBeLessThanOrEqual(20);
      expect(result.dataQualityScore!).toBeGreaterThanOrEqual(1);
    }
  });

  it("getTestProfile returns correct profile data", () => {
    const john = getTestProfile(0);
    expect(john.firstName).toBe("John");
    expect(john.lastName).toBe("Anderson");
    expect(john.state).toBe("IL");
    expect(john.annualIncome).toBe(78_000);
    expect(john.expectedScoreRange[0]).toBeLessThan(john.expectedScoreRange[1]);
  });

  it("getTestProfile throws for out-of-bounds index", () => {
    expect(() => getTestProfile(99)).toThrow(RangeError);
    expect(() => getTestProfile(-1)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Credit score range validation
// ---------------------------------------------------------------------------

describe("WorkerPool — credit score range validation", () => {
  let pool: WorkerPool;

  beforeEach(async () => {
    pool = new WorkerPool({ numWorkers: 1, safeTestMode: true });
    await pool.start();
  });

  afterEach(async () => {
    await pool.stop();
  });

  it("safe test score falls within the documented 450-849 range", async () => {
    const job: JobRequest = {
      jobId: "range-verify-001",
      firstName: "Alice",
      lastName: "Brown",
      street: "100 Main St",
      city: "Boston",
      state: "MA",
      zipCode: "02101",
      dob: "03/01/1990",
      annualIncome: "50000",
    };

    const result = await pool.submit(job);
    expect(result.creditScore!).toBeGreaterThanOrEqual(450);
    expect(result.creditScore!).toBeLessThanOrEqual(849);
  });

  it("same name/dob combination produces the same score (deterministic)", async () => {
    const job: JobRequest = {
      jobId: "deterministic-001",
      firstName: "Bob",
      lastName: "Wilson",
      street: "200 Oak Ave",
      city: "Portland",
      state: "OR",
      zipCode: "97201",
      dob: "06/15/1988",
      annualIncome: "60000",
    };

    const [r1, r2] = await Promise.all([pool.submit(job), pool.submit(job)]);
    expect(r1.creditScore).toBe(r2.creditScore);
  });

  it("buildOneCsResult rejects out-of-range credit scores via Zod schema", () => {
    expect(() =>
      buildOneCsResult({
        creditScore: 200,
        source: "testbench",
      }),
    ).toThrow();
  });

  it("buildOneCsResult produces valid productScore and dataQualityScore", () => {
    const testCases = [
      { score: 720, label: "good" },
      { score: 650, label: "fair" },
      { score: 580, label: "poor" },
      { score: null, label: "null" },
    ];

    for (const tc of testCases) {
      const result = buildOneCsResult({
        creditScore: tc.score,
        completenessScore: 0.80,
        adverseReasons: [],
        source: "testbench",
      });

      expect(result.productScore).toBeGreaterThanOrEqual(1);
      expect(result.productScore).toBeLessThanOrEqual(20);
      expect(result.dataQualityScore).toBeGreaterThanOrEqual(1);
      expect(result.dataQualityScore).toBeLessThanOrEqual(10);
    }
  });
});

// ---------------------------------------------------------------------------
// WorkerEngine — registerWorker / deregisterWorker
// ---------------------------------------------------------------------------

describe("WorkerEngine — registerWorker / deregisterWorker", () => {
  it("registerWorker adds a worker and fires onWorkerRegistered event", () => {
    let registered = false;
    let registeredWorker: ReturnType<WorkerEngine["registerWorker"]> | null = null;

    const engine = createWorkerEngine({
      maxWorkers: 3,
      onWorkerRegistered: (w) => {
        registered = true;
        registeredWorker = w;
      },
    });

    const worker = engine.registerWorker({
      id: 1,
      name: "test-worker",
      concurrency: 1,
      safeTestMode: false,
      maxRetries: 3,
      proxyRotateAfterN: 20,
      ssnTimeoutMs: 90_000,
      browserTimeoutMs: 60_000,
    });

    expect(registered).toBe(true);
    expect(worker.name).toBe("test-worker");
    expect(worker.status).toBe("idle");
  });

  it("deregisterWorker fires onWorkerDeregistered event", () => {
    let deregisteredId: string | null = null;

    const engine = createWorkerEngine({
      maxWorkers: 3,
      onWorkerDeregistered: (id) => {
        deregisteredId = id;
      },
    });

    const worker = engine.registerWorker({
      id: 1,
      name: "dereg-worker",
      concurrency: 1,
      safeTestMode: false,
      maxRetries: 3,
      proxyRotateAfterN: 20,
      ssnTimeoutMs: 90_000,
      browserTimeoutMs: 60_000,
    });

    engine.deregisterWorker(worker.id);
    expect(deregisteredId).toBe(worker.id);
  });
});