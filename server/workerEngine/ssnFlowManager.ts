/**
 * SSN Flow Manager
 *
 * Manages the SSN request/response cycle for credit score jobs.
 * Operators submit jobs with SSN required; when the browser encounters
 * an SSN field, the manager pauses the job and awaits operator input
 * via Telegram or dashboard. The Promise-based API allows clean async
 * integration with the browser session.
 */

export type SsnRequestRecord = {
  jobId: string;
  chatId: string | null;
  createdAt: Date;
  status: "pending" | "resolved" | "canceled" | "expired";
};

export type SsnValidateResult =
  | { valid: true; normalized: string }
  | { valid: false; reason: string };

const SSN_DIGIT_RE = /^\d{3}-\d{2}-\d{4}$|^\d{9}$/;

const SSN_AREA_RE = /^(?:\d{3}|\d{2}|\d{1})/;

function ssnAreaDigits(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  const area = parseInt(digits.slice(0, 3), 10);
  return area;
}

/** Reject known invalid SSN area numbers per SSA rules: 000, 666, 900-909 */
const INVALID_AREAS = new Set(["0".padStart(3, "0"), "666", "900", "901", "902", "903", "904", "905", "906", "907", "908", "909"]);

export class SSNFlowManager {
  /**
   * Map from jobId → pending Promise resolvers.
   * The inner record holds the resolve/reject functions plus metadata.
   */
  private readonly _pending = new Map<
    string,
    {
      resolve: (ssn: string) => void;
      reject: (err: Error) => void;
      record: SsnRequestRecord;
    }
  >();

  /**
   * Expire requests after this many milliseconds.
   * Default: 10 minutes.
   */
  private readonly _ttlMs: number;

  private _expiryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(ttlMs = 10 * 60 * 1000) {
    this._ttlMs = ttlMs;
  }

  /** Number of currently pending SSN requests. */
  get pendingCount(): number {
    return this._pending.size;
  }

  /** True if there is a pending request for the given jobId. */
  hasPending(jobId: string): boolean {
    return this._pending.has(jobId);
  }

  /**
   * Create a pending SSN request for a job.
   * Returns a Promise that resolves when the operator provides the SSN
   * (via `provideSsn`) or rejects if the request times out or is canceled.
   *
   * @param jobId - The job's public ID
   * @param chatId - Telegram chat ID where the request is sent (can be null for dashboard-only flow)
   */
  createRequest(jobId: string, chatId: string | null = null): Promise<string> {
    if (this._pending.has(jobId)) {
      return Promise.reject(new Error(`SSN request already pending for job ${jobId}`));
    }

    const record: SsnRequestRecord = {
      jobId,
      chatId,
      createdAt: new Date(),
      status: "pending",
    };

    return new Promise<string>((resolve, reject) => {
      this._pending.set(jobId, { resolve, reject, record });

      // Schedule expiry
      const timer = setTimeout(() => {
        this._pending.delete(jobId);
        reject(new Error(`SSN request expired for job ${jobId} after ${this._ttlMs}ms`));
      }, this._ttlMs);

      // Keep timer reference so we can cancel it on resolve/reject
      void timer;
    });
  }

  /**
   * Provide an SSN for a pending job. Validates the format before resolving.
   *
   * @returns An SsnValidateResult indicating whether validation succeeded.
   */
  provideSsn(jobId: string, raw: string): SsnValidateResult {
    const entry = this._pending.get(jobId);
    if (!entry) {
      return { valid: false, reason: `No pending SSN request for job ${jobId}` };
    }

    const validation = SSNFlowManager.validateSsn(raw);
    if (!validation.valid) {
      return validation;
    }

    const { resolve } = entry;
    this._pending.delete(jobId);
    entry.record.status = "resolved";
    resolve(validation.normalized);

    return validation;
  }

  /**
   * Cancel a pending SSN request without providing the SSN.
   */
  cancelRequest(jobId: string): void {
    const entry = this._pending.get(jobId);
    if (!entry) return;

    const { reject } = entry;
    this._pending.delete(jobId);
    entry.record.status = "canceled";
    reject(new Error(`SSN request canceled for job ${jobId}`));
  }

  /**
   * Validate and normalize an SSN string.
   *
   * Accepts two formats:
   *   - "XXX-XX-XXXX" (dashed)
   *   - "XXXXXXXXX"   (raw 9-digit)
   *
   * Returns a normalized result or `{ valid: false, reason }`.
   */
  static validateSsn(raw: string): SsnValidateResult {
    const cleaned = (raw ?? "").trim();

    if (!cleaned) {
      return { valid: false, reason: "SSN cannot be empty" };
    }

    if (!SSN_DIGIT_RE.test(cleaned)) {
      return { valid: false, reason: "SSN must be 9 digits, optionally formatted as XXX-XX-XXXX" };
    }

    const digits = cleaned.replace(/\D/g, "");

    if (digits.length !== 9) {
      return { valid: false, reason: "SSN must contain exactly 9 digits" };
    }

    const area = ssnAreaDigits(digits);
    if (INVALID_AREAS.has(String(area).padStart(3, "0"))) {
      return { valid: false, reason: "Invalid SSN area number" };
    }

    const group = parseInt(digits.slice(3, 5), 10);
    if (group === 0) {
      return { valid: false, reason: "Invalid SSN group number (first two digits cannot be 00)" };
    }

    const serial = parseInt(digits.slice(5, 9), 10);
    if (serial === 0) {
      return { valid: false, reason: "Invalid SSN serial number (last four digits cannot be 0000)" };
    }

    // Normalize to dashed format
    const normalized = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`;
    return { valid: true, normalized };
  }

  /**
   * Validate a raw SSN string (instance method convenience wrapper).
   */
  validateSsn(raw: string): SsnValidateResult {
    return SSNFlowManager.validateSsn(raw);
  }

  /** Iterator over all pending request records (read-only). */
  pendingRequests(): ReadonlyArray<SsnRequestRecord> {
    return Array.from(this._pending.values(), entry => entry.record);
  }
}