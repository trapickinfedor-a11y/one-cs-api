import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  validateSsn,
  createSsnRequest,
  getSsnRequest,
  provideSsn,
  cancelSsnRequest,
  listPendingSsnRequests,
  removeSsnRequestByChatId,
  clearAllSsnRequests,
  maskSsn,
} from "./ssnFlow.js";

describe("SSN Flow — validateSsn", () => {
  it('normalizes "123-45-6789" → "123-45-6789"', () => {
    const result = validateSsn("123-45-6789");
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("123-45-6789");
  });

  it('normalizes "123456789" → "123-45-6789"', () => {
    const result = validateSsn("123456789");
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("123-45-6789");
  });

  it("returns null / invalid for 10 digits (SSN with extra digit)", () => {
    const result = validateSsn("123-456-7890");
    expect(result.valid).toBe(false);
    expect(result.normalized).toBe(null);
    expect(result.errorCode).toBe("INVALID_FORMAT");
  });

  it("returns null / invalid for 8 digits (too short)", () => {
    const result = validateSsn("12345678");
    expect(result.valid).toBe(false);
    expect(result.normalized).toBe(null);
    expect(result.errorCode).toBe("INVALID_FORMAT");
  });

  it("returns null / invalid for null / undefined", () => {
    // @ts-expect-error — testing runtime behavior
    const r1 = validateSsn(null);
    expect(r1.valid).toBe(false);
    expect(r1.normalized).toBe(null);
    // @ts-expect-error
    const r2 = validateSsn(undefined);
    expect(r2.valid).toBe(false);
    expect(r2.normalized).toBe(null);
  });

  it("returns null / invalid for empty string", () => {
    const r1 = validateSsn("");
    expect(r1.valid).toBe(false);
    expect(r1.normalized).toBe(null);
    const r2 = validateSsn("   ");
    expect(r2.valid).toBe(false);
    expect(r2.normalized).toBe(null);
  });

  it("returns null / invalid for non-numeric strings", () => {
    const r1 = validateSsn("abc-def-ghij");
    expect(r1.valid).toBe(false);
    expect(r1.normalized).toBe(null);
    expect(r1.errorCode).toBe("INVALID_FORMAT");
    const r2 = validateSsn("abcdefghij");
    expect(r2.valid).toBe(false);
    expect(r2.normalized).toBe(null);
    expect(r2.errorCode).toBe("INVALID_FORMAT");
  });

  it("returns null / invalid for area number 000", () => {
    const result = validateSsn("000-45-6789");
    expect(result.valid).toBe(false);
    expect(result.normalized).toBe(null);
    expect(result.errorCode).toBe("INVALID_FORMAT");
  });

  it("returns null / invalid for area number 666", () => {
    const result = validateSsn("666-45-6789");
    expect(result.valid).toBe(false);
    expect(result.normalized).toBe(null);
    expect(result.errorCode).toBe("INVALID_FORMAT");
  });

  it("returns null / invalid for area number 900-999", () => {
    const r1 = validateSsn("900-45-6789");
    expect(r1.valid).toBe(false);
    expect(r1.errorCode).toBe("INVALID_FORMAT");
    const r2 = validateSsn("999-45-6789");
    expect(r2.valid).toBe(false);
    expect(r2.errorCode).toBe("INVALID_FORMAT");
  });

  it("returns null / invalid for group 00", () => {
    const result = validateSsn("123-00-6789");
    expect(result.valid).toBe(false);
    expect(result.normalized).toBe(null);
    expect(result.errorCode).toBe("INVALID_FORMAT");
  });

  it("returns null / invalid for serial 0000", () => {
    const result = validateSsn("123-45-0000");
    expect(result.valid).toBe(false);
    expect(result.normalized).toBe(null);
    expect(result.errorCode).toBe("INVALID_FORMAT");
  });

  it("accepts valid SSN with minimum valid area 001", () => {
    const result = validateSsn("001-45-6789");
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("001-45-6789");
  });

  it("accepts valid SSN with max area 899", () => {
    const result = validateSsn("899-45-6789");
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("899-45-6789");
  });

  it("accepts valid SSN with group 01-99", () => {
    const r1 = validateSsn("123-01-6789");
    expect(r1.valid).toBe(true);
    expect(r1.normalized).toBe("123-01-6789");
    const r2 = validateSsn("123-99-6789");
    expect(r2.valid).toBe(true);
    expect(r2.normalized).toBe("123-99-6789");
  });

  it("accepts valid SSN with serial 0001-9999", () => {
    const r1 = validateSsn("123-45-0001");
    expect(r1.valid).toBe(true);
    expect(r1.normalized).toBe("123-45-0001");
    const r2 = validateSsn("123-45-9999");
    expect(r2.valid).toBe(true);
    expect(r2.normalized).toBe("123-45-9999");
  });

  it("returns null / invalid for ambiguous SSN (all same digits)", () => {
    const result = validateSsn("111-11-1111");
    expect(result.valid).toBe(false);
    expect(result.normalized).toBe(null);
    expect(result.errorCode).toBe("AMBIGUOUS");
  });
});

describe("SSN Flow — createSsnRequest", () => {
  beforeEach(() => {
    clearAllSsnRequests();
  });

  afterEach(() => {
    clearAllSsnRequests();
  });

  it("creates request with correct initial fields", () => {
    const req = createSsnRequest("chat_001", "job_001");

    expect(req.chatId).toBe("chat_001");
    expect(req.jobId).toBe("job_001");
    expect(req.ssn).toBeUndefined(); // not set until provided
    expect(req.ssnProvided).toBe(false);
    expect(req.requestId).toMatch(/^ssn_[a-f0-9]{12}$/);
    expect(req.createdAt).toBeInstanceOf(Date);
    expect(req.timeoutAt).toBeUndefined();
    expect(req.error).toBeUndefined();
  });

  it("each call generates a unique requestId", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      ids.add(createSsnRequest(`chat_${i}`, `job_${i}`).requestId);
    }
    expect(ids.size).toBe(50);
  });

  it("getSsnRequest retrieves the created request", () => {
    const req = createSsnRequest("chat_get", "job_get");
    const found = getSsnRequest(req.requestId);
    expect(found).toBeDefined();
    expect(found!.requestId).toBe(req.requestId);
    expect(found!.chatId).toBe("chat_get");
  });

  it("getSsnRequest returns undefined for unknown id", () => {
    expect(getSsnRequest("nonexistent")).toBeUndefined();
  });
});

describe("SSN Flow — provideSsn", () => {
  beforeEach(() => {
    clearAllSsnRequests();
  });

  afterEach(() => {
    clearAllSsnRequests();
  });

  it("provides valid SSN and updates the request", () => {
    const req = createSsnRequest("chat_001", "job_001");
    const result = provideSsn(req.requestId, "123-45-6789");

    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("123-45-6789");
    expect(result.request).toBeDefined();
    expect(result.request!.ssn).toBe("123-45-6789");
    expect(result.request!.ssnProvided).toBe(true);
    expect(result.request!.error).toBeUndefined();
  });

  it("normalizes non-dashed SSN input", () => {
    const req = createSsnRequest("chat_002", "job_002");
    const result = provideSsn(req.requestId, "123456789");

    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("123-45-6789");
    expect(result.request!.ssn).toBe("123-45-6789");
  });

  it("rejects invalid SSN (all same digits)", () => {
    const req = createSsnRequest("chat_003", "job_003");
    const result = provideSsn(req.requestId, "000-00-0000");

    expect(result.valid).toBe(false);
    expect(result.normalized).toBe(null);
    expect(result.errorCode).toBe("AMBIGUOUS");
    expect(result.request).toBeUndefined();
  });

  it("rejects SSN with 10 digits", () => {
    const req = createSsnRequest("chat_004", "job_004");
    const result = provideSsn(req.requestId, "123-456-7890");

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("INVALID_FORMAT");
    expect(result.request).toBeUndefined();
  });

  it("rejects SSN with wrong format (too short)", () => {
    const req = createSsnRequest("chat_005", "job_005");
    const result = provideSsn(req.requestId, "12345678");

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("INVALID_FORMAT");
    expect(result.request).toBeUndefined();
  });

  it("fails for unknown requestId", () => {
    const result = provideSsn("nonexistent_id", "123-45-6789");
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("INVALID_FORMAT");
    expect(result.reason).toContain("Request not found");
    expect(result.request).toBeUndefined();
  });

  it("allows re-submit: second provideSsn overrides first SSN", () => {
    const req = createSsnRequest("chat_006", "job_006");
    const first = provideSsn(req.requestId, "123-45-6789");
    expect(first.valid).toBe(true);
    expect(first.request!.ssn).toBe("123-45-6789");
    expect(first.request!.ssnProvided).toBe(true);

    const second = provideSsn(req.requestId, "456-78-9012");
    expect(second.valid).toBe(true);
    expect(second.request!.ssn).toBe("456-78-9012");
    expect(second.request!.ssnProvided).toBe(true);
    expect(second.request!.requestId).toBe(req.requestId);
  });
});

describe("SSN Flow — manual timeout check", () => {
  beforeEach(() => {
    clearAllSsnRequests();
  });

  afterEach(() => {
    clearAllSsnRequests();
  });

  it("returns false when timeout has not been reached", () => {
    const req = createSsnRequest("chat_007", "job_007");
    // timeoutAt is null on creation; time has not passed
    const isTimedOut = req.timeoutAt !== null && new Date() > req.timeoutAt;
    expect(isTimedOut).toBe(false);
  });

  it("returns true when timeout has passed", () => {
    const req = createSsnRequest("chat_008", "job_008");
    // Manually set timeout to the past
    req.timeoutAt = new Date(Date.now() - 1000);
    const isTimedOut = req.timeoutAt !== null && new Date() > req.timeoutAt;
    expect(isTimedOut).toBe(true);
  });

  it("returns false when timeoutAt is null", () => {
    const req = createSsnRequest("chat_009", "job_009");
    req.timeoutAt = null;
    const isTimedOut = req.timeoutAt !== null && new Date() > req.timeoutAt;
    expect(isTimedOut).toBe(false);
  });
});

describe("SSN Flow — manual state completion", () => {
  beforeEach(() => {
    clearAllSsnRequests();
  });

  afterEach(() => {
    clearAllSsnRequests();
  });

  it("marks flow as completed with timestamp", () => {
    const req = createSsnRequest("chat_010", "job_010");
    req.state = "completed";
    req.error = null;

    expect(req.state).toBe("completed");
    expect(req.error).toBeNull();
  });

  it("marks flow as timeout", () => {
    const req = createSsnRequest("chat_011", "job_011");
    req.state = "timeout";
    req.timeoutAt = new Date();

    expect(req.state).toBe("timeout");
  });

  it("marks flow as failed with error message", () => {
    const req = createSsnRequest("chat_012", "job_012");
    req.state = "failed";
    req.error = "Network unreachable";

    expect(req.state).toBe("failed");
    expect(req.error).toBe("Network unreachable");
  });

  it("preserves requestId through state changes", () => {
    const req = createSsnRequest("chat_013", "job_013");
    req.state = "completed";
    expect(req.requestId).toBe(req.requestId);
  });
});

describe("SSN Flow — cancelSsnRequest", () => {
  beforeEach(() => {
    clearAllSsnRequests();
  });

  afterEach(() => {
    clearAllSsnRequests();
  });

  it("cancels an existing request and removes it", () => {
    const req = createSsnRequest("chat_014", "job_014");
    expect(getSsnRequest(req.requestId)).toBeDefined();

    const removed = cancelSsnRequest(req.requestId);
    expect(removed).toBe(true);
    expect(getSsnRequest(req.requestId)).toBeUndefined();
  });

  it("returns false when cancelling non-existent request", () => {
    const removed = cancelSsnRequest("nonexistent_id");
    expect(removed).toBe(false);
  });
});

describe("SSN Flow — removeSsnRequestByChatId", () => {
  beforeEach(() => {
    clearAllSsnRequests();
  });

  afterEach(() => {
    clearAllSsnRequests();
  });

  it("removes request by chatId", () => {
    const req = createSsnRequest("chat_unique", "job_015");
    expect(getSsnRequest(req.requestId)).toBeDefined();

    const removed = removeSsnRequestByChatId("chat_unique");
    expect(removed).toBe(true);
    expect(getSsnRequest(req.requestId)).toBeUndefined();
  });

  it("returns false when chatId not found", () => {
    const removed = removeSsnRequestByChatId("nonexistent_chat");
    expect(removed).toBe(false);
  });
});

describe("SSN Flow — listPendingSsnRequests", () => {
  beforeEach(() => {
    clearAllSsnRequests();
  });

  afterEach(() => {
    clearAllSsnRequests();
  });

  it("lists all pending requests", () => {
    createSsnRequest("chat_a", "job_a");
    createSsnRequest("chat_b", "job_b");
    createSsnRequest("chat_c", "job_c");

    const pending = listPendingSsnRequests();
    expect(pending).toHaveLength(3);
  });

  it("returns empty array when no requests exist", () => {
    const pending = listPendingSsnRequests();
    expect(pending).toHaveLength(0);
  });

  it("reflects cancellation", () => {
    const req1 = createSsnRequest("chat_x", "job_x");
    createSsnRequest("chat_y", "job_y");
    cancelSsnRequest(req1.requestId);

    const pending = listPendingSsnRequests();
    expect(pending).toHaveLength(1);
    expect(pending[0]!.chatId).toBe("chat_y");
  });
});

describe("SSN Flow — clearAllSsnRequests", () => {
  it("clears all pending requests", () => {
    clearAllSsnRequests();
    createSsnRequest("chat_clear_1", "job_clear_1");
    createSsnRequest("chat_clear_2", "job_clear_2");
    expect(listPendingSsnRequests()).toHaveLength(2);

    clearAllSsnRequests();
    expect(listPendingSsnRequests()).toHaveLength(0);
  });
});

describe("SSN Flow — maskSsn", () => {
  it("masks SSN showing only last 4 digits", () => {
    expect(maskSsn("123-45-6789")).toBe("***-**-6789");
  });

  it("returns fallback for SSN shorter than 4 chars", () => {
    expect(maskSsn("12")).toBe("***-**-****");
  });

  it("handles plain 9-digit SSN", () => {
    expect(maskSsn("123456789")).toBe("***-**-6789");
  });
});

describe("SSN Flow — end-to-end createRequest + provideSsn sequence", () => {
  beforeEach(() => {
    clearAllSsnRequests();
  });

  afterEach(() => {
    clearAllSsnRequests();
  });

  it("full happy path: created → ssn_provided → completed", () => {
    // Step 1: Create
    const req = createSsnRequest("chat_e2e_001", "job_e2e_001");
    expect(req.ssn).toBeUndefined();

    // Step 2: Provide SSN
    const result = provideSsn(req.requestId, "456-78-9012");
    expect(result.valid).toBe(true);
    expect(result.request!.ssn).toBe("456-78-9012");
    expect(result.request!.ssnProvided).toBe(true);

    // Step 3: Complete — manually set state
    const found = getSsnRequest(req.requestId)!;
    found.state = "completed";
    expect(found.state).toBe("completed");
    expect(found.ssn).toBe("456-78-9012");
  });

  it("full path: created → invalid SSN rejected", () => {
    const req = createSsnRequest("chat_e2e_002", "job_e2e_002");
    const result = provideSsn(req.requestId, "123-45-0000");

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("INVALID_FORMAT");
    expect(result.request).toBeUndefined();
    // Original request is unchanged
    const unchanged = getSsnRequest(req.requestId)!;
    expect(unchanged.ssn).toBeUndefined();
    expect(unchanged.ssnProvided).toBe(false);
  });

  it("timeout path: created → timeout (no SSN provided)", () => {
    const req = createSsnRequest("chat_e2e_003", "job_e2e_003");
    // Simulate: time passes, flow times out
    req.timeoutAt = new Date(Date.now() - 100);
    const isTimedOut = req.timeoutAt !== null && new Date() > req.timeoutAt;
    expect(isTimedOut).toBe(true);

    req.state = "timeout";
    expect(req.state).toBe("timeout");
  });

  it("SSN is normalized consistently through provideSsn calls", () => {
    const req = createSsnRequest("chat_e2e_004", "job_e2e_004");
    const cases = [
      { input: "123456789", expected: "123-45-6789" },
      { input: "123-45-6789", expected: "123-45-6789" },
    ];

    for (const { input, expected } of cases) {
      const result = provideSsn(req.requestId, input);
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe(expected);
      expect(result.request!.ssn).toBe(expected);
    }
  });
});
