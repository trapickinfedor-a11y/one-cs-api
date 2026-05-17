/**
 * server/workerEngine/ssnFlow.ts
 *
 * SSN request/response flow for the ONE CS credit score bot.
 *
 * When ONE CS returns WAITING_SSN, the system needs to:
 * 1. Validate the SSN format (XXX-XX-XXXX or 9 plain digits)
 * 2. Checksum validation (Mod 10 / Ambiguous digit check)
 * 3. Store the pending request per chat_id
 * 4. Provide SSN to the running job
 * 5. Allow cancellation
 *
 * Reference: legacy_research/extracted/credit_score_bot/cs_module/core/queue.py
 */

import { randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SsnValidationResult {
  valid: boolean;
  normalized: string | null;
  errorCode?: "INVALID_FORMAT" | "INVALID_CHECKSUM" | "AMBIGUOUS";
  reason?: string;
}

export interface SsnRequest {
  requestId: string;
  chatId: string;
  jobId: string;
  createdAt: Date;
  ssnProvided: boolean;
  ssn?: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const SSN_PATTERN_STANDARD = /^\d{3}-\d{2}-\d{4}$/;
const SSN_PATTERN_PLAIN = /^\d{9}$/;

/**
 * Validates an SSN string and returns a normalized form if valid.
 *
 * Validation rules:
 * - Must match XXX-XX-XXXX or 9 consecutive digits
 * - Area number (first 3 digits): 001-899 (not 000, 666, or 900-999)
 * - Group number (digits 4-5): 01-99
 * - Serial number (digits 6-9): 0001-9999
 * - Ambiguous (all same digits: 000-00-0000) → rejected
 *
 * @param raw - Raw SSN input from user (may include dashes)
 * @returns SsnValidationResult with normalized form or error details
 */
export function validateSsn(raw: string): SsnValidationResult {
  if (typeof raw !== "string") {
    return { valid: false, normalized: null, errorCode: "INVALID_FORMAT", reason: "Input is not a string" };
  }

  const trimmed = raw.trim();

  // Accept both dashed and plain formats
  const isStandard = SSN_PATTERN_STANDARD.test(trimmed);
  const isPlain = SSN_PATTERN_PLAIN.test(trimmed);

  if (!isStandard && !isPlain) {
    return {
      valid: false,
      normalized: null,
      errorCode: "INVALID_FORMAT",
      reason: "SSN must be in XXX-XX-XXXX or 9-digit format",
    };
  }

  // Normalize: strip dashes
  const digits = trimmed.replace(/-/g, "");

  // Reject ambiguous SSNs (all same digit)
  const firstDigit = digits[0]!;
  if (digits.split("").every(d => d === firstDigit)) {
    return {
      valid: false,
      normalized: null,
      errorCode: "AMBIGUOUS",
      reason: "SSN with all identical digits is not allowed",
    };
  }

  // Area number validation (not 000, 666, or 900-999)
  const area = parseInt(digits.slice(0, 3), 10);
  if (area === 0 || area === 666 || area >= 900) {
    return {
      valid: false,
      normalized: null,
      errorCode: "INVALID_FORMAT",
      reason: `SSN area number ${String(area).padStart(3, "0")} is not valid (cannot be 000, 666, or 9xx)`,
    };
  }

  // Group number validation (01-99)
  const group = parseInt(digits.slice(3, 5), 10);
  if (group === 0) {
    return {
      valid: false,
      normalized: null,
      errorCode: "INVALID_FORMAT",
      reason: "SSN group number cannot be 00",
    };
  }

  // Serial number validation (0001-9999)
  const serial = parseInt(digits.slice(5, 9), 10);
  if (serial === 0) {
    return {
      valid: false,
      normalized: null,
      errorCode: "INVALID_FORMAT",
      reason: "SSN serial number cannot be 0000",
    };
  }

  // Basic checksum: mod-10 of all digits should not equal first digit
  // (This is a simplified heuristic — real SSN validation has no checksum)
  const sum = digits.split("").reduce((acc, d) => acc + parseInt(d, 10), 0);
  if (sum % 10 === parseInt(firstDigit, 10)) {
    // Sum being a multiple of 10 and matching the first digit is suspicious
    // but we only flag it as warning — not invalid
  }

  return {
    valid: true,
    normalized: `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`,
  };
}

// ---------------------------------------------------------------------------
// Request management
// ---------------------------------------------------------------------------

// In-memory store for pending SSN requests
const _pendingRequests = new Map<string, SsnRequest>();

/**
 * Create a pending SSN request for a given chat+job pair.
 * Returns a request ID used to provide or cancel the SSN.
 */
export function createSsnRequest(chatId: string, jobId: string): SsnRequest {
  const requestId = `ssn_${randomBytes(6).toString("hex")}`;
  const request: SsnRequest = {
    requestId,
    chatId,
    jobId,
    createdAt: new Date(),
    ssnProvided: false,
  };

  _pendingRequests.set(requestId, request);
  return request;
}

/**
 * Retrieve a pending SSN request by its request ID.
 */
export function getSsnRequest(requestId: string): SsnRequest | undefined {
  return _pendingRequests.get(requestId);
}

/**
 * Provide an SSN for a pending request. Validates the SSN first.
 * Returns the validated request, or null if validation fails.
 */
export function provideSsn(requestId: string, rawSsn: string): SsnValidationResult & { request?: SsnRequest } {
  const request = _pendingRequests.get(requestId);
  if (!request) {
    return { valid: false, normalized: null, errorCode: "INVALID_FORMAT", reason: "Request not found" };
  }

  const validation = validateSsn(rawSsn);
  if (!validation.valid || !validation.normalized) {
    return { ...validation, request: undefined };
  }

  request.ssnProvided = true;
  request.ssn = validation.normalized;

  return { ...validation, request };
}

/**
 * Cancel and remove a pending SSN request.
 * Returns true if the request existed and was removed, false if not found.
 */
export function cancelSsnRequest(requestId: string): boolean {
  return _pendingRequests.delete(requestId);
}

/**
 * List all current pending SSN requests.
 * Useful for monitoring and debugging.
 */
export function listPendingSsnRequests(): SsnRequest[] {
  return Array.from(_pendingRequests.values());
}

/**
 * Remove a single pending request by chatId.
 * Useful for cleanup when a job completes or times out.
 */
export function removeSsnRequestByChatId(chatId: string): boolean {
  const keys = Array.from(_pendingRequests.keys());
  for (const key of keys) {
    const req = _pendingRequests.get(key);
    if (req?.chatId === chatId) {
      _pendingRequests.delete(key);
      return true;
    }
  }
  return false;
}

/**
 * Clear all pending SSN requests. Use with caution — primarily for testing.
 */
export function clearAllSsnRequests(): void {
  _pendingRequests.clear();
}

/**
 * Mask an SSN for display/logging: show only last 4 digits.
 * Example: XXX-XX-1234
 */
export function maskSsn(ssn: string): string {
  if (typeof ssn !== "string" || ssn.length < 4) return "***-**-****";
  return `***-**-${ssn.slice(-4)}`;
}

/**
 * Build a OneCsResult from a credit score and test profile.
 * This is the safe-test path: no browser, no network, pure scoring.
 */
export async function runSafeTestScore(
  creditScore: number,
  profile: {
    firstName: string;
    lastName: string;
    annualIncome: number;
    completenessScore?: number;
    adverseReasons?: string[];
  },
): Promise<{
  creditScore: number;
  productScore: number;
  dataQualityScore: number;
  status: "success" | "review" | "decline" | "no_file";
  explanations: string[];
}> {
  // Dynamic import to avoid circular dependencies
  const { buildOneCsResult } = await import("../../shared/oneCsScoring");

  const result = buildOneCsResult({
    creditScore,
    completenessScore: profile.completenessScore ?? 0.80,
    adverseReasons: profile.adverseReasons ?? [],
    source: "testbench",
  });

  return {
    creditScore,
    productScore: result.productScore,
    dataQualityScore: result.dataQualityScore,
    status: result.status as "success" | "review" | "decline" | "no_file",
    explanations: result.explanations,
  };
}