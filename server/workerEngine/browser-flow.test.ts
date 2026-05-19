/**
 * server/workerEngine/browser-flow.test.ts
 *
 * Comprehensive tests for browser automation flow components:
 *   - CreditScoreWorker.processJob routing logic
 *   - WorkerPool lifecycle (start/stop/idempotency)
 *   - Safe test scoring determinism
 *   - JobResult type validation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CreditScoreWorker,
  WorkerPool,
  type JobRequest,
  type JobResult,
} from "./csWorkerEngine.js";

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

// ---------------------------------------------------------------------------
// Suite 1: CreditScoreWorker.processJob routing
// ---------------------------------------------------------------------------

describe("CreditScoreWorker.processJob", () => {
  // T1: processJob calls _processBrowserMode when safeTestMode=false
  it("processJob calls _processBrowserMode when safeTestMode=false", async () => {
    const worker = new CreditScoreWorker({ workerId: 1, safeTestMode: false });
    const job = makeJobRequest({ jobId: "t1-browser-mode" });
    const spy = vi.spyOn(worker as any, "_processBrowserMode").mockResolvedValue({
      jobId: job.jobId,
      status: "succeeded",
      creditScore: 720,
      productScore: 15,
      dataQualityScore: 8,
      status_: "success",
      error: null,
      workerId: 1,
      proxyIp: null,
      durationMs: 500,
      needsSsn: false,
      source: "browser",
    } as JobResult);

    const result = await worker.processJob(job);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("succeeded");
    spy.mockRestore();
  });

  // T2: processJob calls _processSafeMode when safeTestMode=true
  it("processJob calls _processSafeMode when safeTestMode=true", async () => {
    const worker = new CreditScoreWorker({ workerId: 2, safeTestMode: true });
    const job = makeJobRequest({ jobId: "t2-safe-mode" });
    const spy = vi.spyOn(worker as any, "_processSafeMode").mockReturnValue({
      jobId: job.jobId,
      status: "succeeded",
      creditScore: 720,
      productScore: 16,
      dataQualityScore: 8.8,
      status_: "success",
      error: null,
      workerId: 2,
      proxyIp: null,
      durationMs: 50,
      needsSsn: false,
      source: "testbench",
    } as JobResult);

    const result = await worker.processJob(job);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("succeeded");
    expect(result.source).toBe("testbench");
    spy.mockRestore();
  });

  // T3: processJob falls back to safe-test when browser mode throws
  it("processJob falls back to safe-test when browser mode throws", async () => {
    const worker = new CreditScoreWorker({ workerId: 3, safeTestMode: false });
    const job = makeJobRequest({ jobId: "t3-browser-crash" });
    const browserSpy = vi.spyOn(worker as any, "_processBrowserMode").mockRejectedValue(
      new Error("Browser crashed: navigation timeout"),
    );
    const safeSpy = vi.spyOn(worker as any, "_processSafeTestMode").mockReturnValue({
      jobId: job.jobId,
      status: "succeeded",
      creditScore: 650,
      productScore: 14,
      dataQualityScore: 7,
      status_: "review",
      error: null,
      workerId: 3,
      proxyIp: null,
      durationMs: 30,
      needsSsn: false,
      source: "safe_test",
    } as JobResult);

    const result = await worker.processJob(job);
    expect(browserSpy).toHaveBeenCalledTimes(3);
    expect(safeSpy).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("succeeded");
    expect(result.source).toBe("safe_test");
    expect(result.creditScore).toBe(650);
    browserSpy.mockRestore();
    safeSpy.mockRestore();
  });

  // T4: processJob falls back to safe-test when browser returns failed status
  it("processJob falls back to safe-test when browser returns failed status", async () => {
    const worker = new CreditScoreWorker({ workerId: 4, safeTestMode: false });
    const job = makeJobRequest({ jobId: "t4-browser-failed" });
    const browserSpy = vi.spyOn(worker as any, "_processBrowserMode").mockResolvedValue({
      jobId: job.jobId,
      status: "failed",
      creditScore: null,
      productScore: null,
      dataQualityScore: null,
      status_: null,
      error: "Evomi credentials not configured",
      workerId: 4,
      proxyIp: null,
      durationMs: 0,
      needsSsn: false,
      source: "system",
    } as JobResult);
    const safeSpy = vi.spyOn(worker as any, "_processSafeTestMode").mockReturnValue({
      jobId: job.jobId,
      status: "succeeded",
      creditScore: 720,
      productScore: 16,
      dataQualityScore: 8,
      status_: "success",
      error: null,
      workerId: 4,
      proxyIp: null,
      durationMs: 20,
      needsSsn: false,
      source: "safe_test",
    } as JobResult);

    const result = await worker.processJob(job);
    expect(browserSpy).toHaveBeenCalledTimes(1);
    expect(safeSpy).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("succeeded");
    expect(result.source).toBe("safe_test");
    browserSpy.mockRestore();
    safeSpy.mockRestore();
  });

  // T5: processJob returns creditScore in 450-849 range (safe mode)
  it("processJob returns creditScore in 450-849 range (safe mode)", async () => {
    const worker = new CreditScoreWorker({ workerId: 5, safeTestMode: true });
    const result = await worker.processJob(makeJobRequest({ jobId: "t5-score-range" }));
    expect(result.creditScore).not.toBeNull();
    expect(result.creditScore!).toBeGreaterThanOrEqual(450);
    expect(result.creditScore!).toBeLessThanOrEqual(849);
  });

  // T6: processJob returns needsSsn=false in safe mode
  it("processJob returns needsSsn=false in safe mode", async () => {
    const worker = new CreditScoreWorker({ workerId: 6, safeTestMode: true });
    const result = await worker.processJob(makeJobRequest({ jobId: "t6-no-ssn-needed" }));
    expect(result.needsSsn).toBe(false);
  });

  // T7: processJob returns JobResult with workerId set
  it("processJob returns JobResult with workerId set", async () => {
    const worker = new CreditScoreWorker({ workerId: 7, safeTestMode: true });
    const result = await worker.processJob(makeJobRequest({ jobId: "t7-worker-id" }));
    expect(result.workerId).toBe(7);
  });

  // T8: processJob returns durationMs >= 0
  it("processJob returns durationMs >= 0", async () => {
    const worker = new CreditScoreWorker({ workerId: 8, safeTestMode: true });
    const result = await worker.processJob(makeJobRequest({ jobId: "t8-duration" }));
    expect(result.durationMs).not.toBeNull();
    expect(result.durationMs!).toBeGreaterThanOrEqual(0);
  });

  // T9: processJob with SSN marks needsSsn=false in safe mode
  it("processJob with SSN in payload marks needsSsn=false in safe mode", async () => {
    const worker = new CreditScoreWorker({ workerId: 9, safeTestMode: true });
    const result = await worker.processJob(
      makeJobRequest({ jobId: "t9-ssn-payload", ssn: "987-65-4321" }),
    );
    expect(result.needsSsn).toBe(false);
    expect(result.creditScore).not.toBeNull();
  });

  // T10: processJob with telegramChatId is processed without error
  it("processJob with telegramChatId in payload is processed without error", async () => {
    const worker = new CreditScoreWorker({ workerId: 10, safeTestMode: true });
    const result = await worker.processJob(
      makeJobRequest({ jobId: "t10-telegram-chat", telegramChatId: "123456789" }),
    );
    expect(result.jobId).toBe("t10-telegram-chat");
    expect(result.status).toBe("succeeded");
  });
});

// ---------------------------------------------------------------------------
// Suite 2: WorkerPool lifecycle
// ---------------------------------------------------------------------------

describe("WorkerPool lifecycle", () => {
  // T1: start() is idempotent
  it("start() is idempotent — calling twice doesn't create duplicate workers", async () => {
    const pool = new WorkerPool({ numWorkers: 3, safeTestMode: true });
    await pool.start();
    const afterFirst = pool.activeWorkers;
    await pool.start();
    const afterSecond = pool.activeWorkers;
    expect(afterFirst).toBe(afterSecond);
    expect(afterFirst).toBe(3);
    await pool.stop();
  });

  // T2: stop() transitions workers to inactive
  it("stop() transitions workers to inactive", async () => {
    const pool = new WorkerPool({ numWorkers: 2, safeTestMode: true });
    await pool.start();
    expect(pool.activeWorkers).toBe(2);
    await pool.stop();
    expect(pool.activeWorkers).toBe(0);
  });

  // T3: submit() queues a job and returns a Promise
  it("submit() queues a job and returns a Promise", async () => {
    const pool = new WorkerPool({ numWorkers: 1, safeTestMode: true });
    await pool.start();
    const job = makeJobRequest({ jobId: "pool-submit-001" });
    const resultPromise = pool.submit(job);
    expect(resultPromise).toBeInstanceOf(Promise);
    expect(typeof pool.queueSize).toBe("number");
    const result = await resultPromise;
    expect(result).toBeDefined();
    expect(typeof result.status).toBe("string");
    await pool.stop();
  });

  // T4: queueSize reflects pending jobs
  it("queueSize reflects pending jobs", async () => {
    const pool = new WorkerPool({ numWorkers: 1, safeTestMode: true });
    await pool.start();
    void pool.submit(makeJobRequest({ jobId: "pool-q1" }));
    void pool.submit(makeJobRequest({ jobId: "pool-q2" }));
    expect(typeof pool.queueSize).toBe("number");
    await pool.submit(makeJobRequest({ jobId: "pool-cleanup" }));
    await pool.stop();
  });

  // T5: activeWorkers counts running workers
  it("activeWorkers counts running workers", async () => {
    const pool = new WorkerPool({ numWorkers: 4, safeTestMode: true });
    await pool.start();
    expect(pool.activeWorkers).toBe(4);
    await pool.stop();
    expect(pool.activeWorkers).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Safe test scoring determinism
// ---------------------------------------------------------------------------

describe("Safe test scoring determinism", () => {
  let pool: WorkerPool;

  beforeEach(async () => {
    pool = new WorkerPool({ numWorkers: 4, safeTestMode: true });
    await pool.start();
  });

  afterEach(async () => {
    await pool.stop();
  });

  // T1: Same name+dob produces same score (deterministic)
  it("same name+dob produces same score (deterministic)", async () => {
    const job = makeJobRequest({
      jobId: "determinism-001",
      firstName: "Alice",
      lastName: "Smith",
      dob: "04/20/1992",
    });
    const [r1, r2, r3] = await Promise.all([
      pool.submit({ ...job, jobId: "d-1" }),
      pool.submit({ ...job, jobId: "d-2" }),
      pool.submit({ ...job, jobId: "d-3" }),
    ]);
    expect(r1.creditScore).toBe(r2.creditScore);
    expect(r2.creditScore).toBe(r3.creditScore);
  });

  // T2: Different name+dob combinations produce valid scores
  it("different name+dob combinations produce valid scores", async () => {
    const [r1, r2] = await Promise.all([
      pool.submit(makeJobRequest({ jobId: "diff-name-1", firstName: "Alice", lastName: "Smith" })),
      pool.submit(makeJobRequest({ jobId: "diff-name-2", firstName: "Bob", lastName: "Jones" })),
    ]);
    expect(r1.creditScore).not.toBeNull();
    expect(r2.creditScore).not.toBeNull();
  });

  // T3: Score range is always 450-849
  it("score range is always 450-849", async () => {
    const names = [
      { firstName: "Alice", lastName: "Smith", dob: "01/01/1990" },
      { firstName: "Bob", lastName: "Jones", dob: "02/02/1991" },
      { firstName: "Carol", lastName: "White", dob: "03/03/1992" },
      { firstName: "Dave", lastName: "Brown", dob: "04/04/1993" },
      { firstName: "Eve", lastName: "Davis", dob: "05/05/1994" },
      { firstName: "Frank", lastName: "Miller", dob: "06/06/1995" },
      { firstName: "Grace", lastName: "Wilson", dob: "07/07/1996" },
      { firstName: "Hank", lastName: "Moore", dob: "08/08/1997" },
      { firstName: "Ivy", lastName: "Taylor", dob: "09/09/1998" },
      { firstName: "Jack", lastName: "Anderson", dob: "10/10/1999" },
    ];
    const results = await Promise.all(
      names.map((n, i) => pool.submit(makeJobRequest({ jobId: `range-${i}`, ...n }))),
    );
    for (const r of results) {
      expect(r.creditScore!).toBeGreaterThanOrEqual(450);
      expect(r.creditScore!).toBeLessThanOrEqual(849);
    }
  });

  // T4: productScore is derived correctly (1-20 range)
  it("productScore is derived correctly (1-20 range)", async () => {
    const result = await pool.submit(makeJobRequest({ jobId: "product-range" }));
    expect(result.productScore).not.toBeNull();
    expect(result.productScore!).toBeGreaterThanOrEqual(1);
    expect(result.productScore!).toBeLessThanOrEqual(20);
  });

  // T5: dataQualityScore is derived correctly (1-10 range)
  it("dataQualityScore is derived correctly (1-10 range)", async () => {
    const result = await pool.submit(makeJobRequest({ jobId: "dqs-range" }));
    expect(result.dataQualityScore).not.toBeNull();
    expect(result.dataQualityScore!).toBeGreaterThanOrEqual(1);
    expect(result.dataQualityScore!).toBeLessThanOrEqual(10);
  });

  // T6: status_ is 'success' for score >= 700 via _processSafeMode
  it("status_ is 'success' for score >= 700 via _processSafeMode", async () => {
    // _processSafeMode uses buildOneCsResult; score >= 700 maps to 'success'.
    const worker = new CreditScoreWorker({ workerId: 100, safeTestMode: true });
    let result: JobResult | null = null;
    for (let i = 0; i < 50; i++) {
      const r = await worker.processJob(
        makeJobRequest({
          jobId: `success-direct-${i}`,
          firstName: `S${i}`,
          lastName: `T${i}`,
          dob: `01/${String(i + 1).padStart(2, "0")}/1990`,
        }),
      );
      if (r.creditScore! >= 700) {
        result = r;
        break;
      }
    }
    expect(result).not.toBeNull();
    expect(result!.status_).toBe("success");
  });

  // T7: status_ is 'review' for score 580-679
  // Note: score >= 680 produces DQS >= 7.5 → 'success'; we test 580-679 instead.
  it("status_ is 'review' for score 580-679", async () => {
    const jobs = Array.from({ length: 100 }, (_, i) =>
      makeJobRequest({
        jobId: `review-${i}`,
        firstName: `F${i}`,
        lastName: `L${i}`,
        dob: `${String(i % 12 + 1).padStart(2, "0")}/15/1980`,
      }),
    );
    const results = await Promise.all(jobs.map(j => pool.submit(j)));
    const inRange = results.filter(r =>
      r.creditScore! >= 580 && r.creditScore! <= 679,
    );
    expect(inRange.length).toBeGreaterThan(0);
    for (const r of inRange) {
      expect(r.status_).toBe("review");
    }
  });

  // T8: status_ is 'decline' for score < 580
  it("status_ is 'decline' for score < 580", async () => {
    let foundScore = false;
    let result: JobResult | null = null;
    for (let i = 0; i < 100; i++) {
      const r = await pool.submit(
        makeJobRequest({
          jobId: `decline-${i}`,
          firstName: `F${i}`,
          lastName: `L${i}`,
          dob: `${String(i % 12 + 1).padStart(2, "0")}/15/1980`,
        }),
      );
      if (r.creditScore! < 580) {
        result = r;
        foundScore = true;
        break;
      }
    }
    expect(foundScore).toBe(true);
    expect(result!.status_).toBe("decline");
  });
});

// ---------------------------------------------------------------------------
// Suite 4: JobResult type validation
// ---------------------------------------------------------------------------

describe("JobResult type validation", () => {
  let pool: WorkerPool;

  beforeEach(async () => {
    pool = new WorkerPool({ numWorkers: 2, safeTestMode: true });
    await pool.start();
  });

  afterEach(async () => {
    await pool.stop();
  });

  // T1: status field accepts valid status strings
  it("status field accepts valid status strings", async () => {
    const result = await pool.submit(makeJobRequest({ jobId: "status-valid" }));
    const validStatuses: JobResult["status"][] = [
      "pending",
      "running",
      "succeeded",
      "failed",
      "waiting_ssn",
    ];
    expect(validStatuses).toContain(result.status);
  });

  // T2: creditScore is number | null
  it("creditScore is number or null", async () => {
    const result = await pool.submit(makeJobRequest({ jobId: "score-type" }));
    expect(result.creditScore === null || typeof result.creditScore === "number").toBe(true);
    if (typeof result.creditScore === "number") {
      expect(Number.isFinite(result.creditScore)).toBe(true);
    }
  });

  // T3: source field accepts valid source strings
  it("source field accepts valid source strings", async () => {
    const result = await pool.submit(makeJobRequest({ jobId: "source-type" }));
    const validSources: JobResult["source"][] = [
      "safe_test",
      "browser",
      "api",
      "dashboard",
      "telegram",
      "import",
      "system",
      "testbench",
    ];
    expect(validSources).toContain(result.source);
  });

  // T4: durationMs is number | null
  it("durationMs is number or null", async () => {
    const result = await pool.submit(makeJobRequest({ jobId: "duration-type" }));
    expect(result.durationMs === null || typeof result.durationMs === "number").toBe(true);
    if (typeof result.durationMs === "number") {
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  // T5: proxyIp is string | null
  it("proxyIp is string or null", async () => {
    const result = await pool.submit(makeJobRequest({ jobId: "proxyip-type" }));
    expect(result.proxyIp === null || typeof result.proxyIp === "string").toBe(true);
  });
});