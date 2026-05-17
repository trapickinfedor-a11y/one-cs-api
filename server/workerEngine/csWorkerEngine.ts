/**
 * CS Worker Engine
 *
 * Orchestrates the credit score scoring pipeline:
 *   1. Accepts JobRequest (personal data profile)
 *   2. Generates fresh fingerprint + acquires proxy
 *   3. Safe mode: computes score from test data via buildOneCsResult
 *   4. Real mode: Playwright browser → universal-credit.com 3-step form
 *      → Adverse Action Notice PDF download → pdfjs-dist text extraction
 *   5. Returns JobResult with credit score, status, and metadata
 *
 * Adapted from legacy Python implementation (cs_worker.py) to TypeScript/Playwright.
 *
 * Reference: legacy_research/extracted/credit_score_bot/cs_module/workers/cs_worker.py
 */

import type { Page, BrowserContext } from "playwright";
import { buildOneCsResult } from "../../shared/oneCsScoring.js";
import { BrowserPool, getBrowserPool } from "./browserPool.js";
import { FingerprintRotator } from "./fingerprintRotator.js";
import { SSNFlowManager } from "./ssnFlowManager.js";
import {
  humanDelay,
  humanType,
  humanClick,
  warmUpPage,
  injectThreatMetrixNoisePost,
  typingDelay,
} from "./humanBehavior.js";
import { extractCreditScore, isValidScore } from "./scoreExtractor.js";
import { ENV } from "../_core/env.js";
import { acquireProxy, releaseProxy } from "../_core/proxy.js";
import type { ProxyAcquireOptions } from "../_core/proxy.js";

// ---------------------------------------------------------------------------
// Constants (mirrors cs_worker.py)
// ---------------------------------------------------------------------------

const UC_FUNNEL_URL =
  "https://www.universal-credit.com/funnel/" +
  "personal-information-1/DEBT_CONSOLIDATION/5000?step=contact";

const UC_DOCUMENTS_URL = "https://www.universal-credit.com/portal/profile/documents";

const STEP_TIMEOUT_MS = 60_000;   // max time per form step
const FORM_TIMEOUT_MS = 120_000;   // max time for full form submission
const PDF_TIMEOUT_MS  = 60_000;   // max time to wait for PDF download

const ACCOUNT_PASSWORD = "Secure#Pass2025!";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JobStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "waiting_ssn";

export interface JobRequest {
  jobId: string;
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  dob: string; // MM/DD/YYYY
  annualIncome: string;
  ssn?: string;
  email?: string;
  phone?: string;
  telegramChatId?: string;
  telegramMessageId?: number;
  maxRetries?: number;
}

export interface JobResult {
  jobId: string;
  status: JobStatus;
  creditScore: number | null;
  productScore: number | null;
  dataQualityScore: number | null;
  status_: "success" | "review" | "decline" | "no_file" | "error" | null;
  error: string | null;
  workerId: number | null;
  proxyIp: string | null;
  durationMs: number | null;
  needsSsn: boolean;
  source: "safe_test" | "browser" | "api" | "dashboard" | "telegram" | "import" | "system" | "testbench";
  explanations?: string[];
  proxyLeaseId?: string;
  pdfPath?: string;
}

export type WorkerEngineConfig = {
  numWorkers?: number;
  headless?: boolean;
  safeTestMode?: boolean;
  proxyCountry?: string;
  maxConcurrency?: number;
  onJobComplete?: (result: JobResult) => void | Promise<void>;
  onEvent?: WorkerPoolEventsHandler;
};

// ---------------------------------------------------------------------------
// Email generator (mirrors cs_worker.py _random_email)
// ---------------------------------------------------------------------------

function randomEmail(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const prefix = Array.from({ length: 10 }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join("");
  const domains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "proton.me"];
  return `${prefix}@${domains[Math.floor(Math.random() * domains.length)]}`;
}

// ---------------------------------------------------------------------------
// PDF extractor (mirrors cs_worker.py _parse_score_from_pdf)
// ---------------------------------------------------------------------------

async function extractScoreFromPdfBytes(pdfBytes: Uint8Array): Promise<number | null> {
  try {
    // Dynamic import to avoid loading on non-browser platforms
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "";
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdfDoc = await loadingTask.promise;
    const lines: string[] = [];

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => item.str ?? "")
        .join(" ");
      lines.push(pageText);
    }

    const fullText = lines.join("\n");

    // Score patterns from cs_worker.py
    const scorePatterns: Array<{ re: RegExp; priority: number }> = [
      { re: /(?:credit\s+score|fico\s+score|score\s+value)[^\d]*(\d{3})/i, priority: 1 },
      { re: /(?:your\s+score\s+is)[^\d]*(\d{3})/i, priority: 2 },
      { re: /(?:score)[^\d]{0,20}(\d{3})/i, priority: 3 },
      { re: /\b([5-8]\d{2})\b/, priority: 4 },
    ];

    for (const { re } of scorePatterns) {
      const allMatches = fullText.matchAll(re);
      const matchArr = Array.from(allMatches);
      if (matchArr.length > 0) {
        // Take the last match (most relevant score on page)
        const last = matchArr[matchArr.length - 1];
        const raw = parseInt(last[1] ?? "0", 10);
        if (isValidScore(raw)) return raw;
      }
    }

    return null;
  } catch {
    // Fallback: try raw byte decode (like pdfminer fallback in Python)
    try {
      const decoder = new TextDecoder("latin-1");
      const raw = decoder.decode(pdfBytes);
      const match = raw.match(/(?:score|credit)[^\d]{0,30}(\d{3})/i);
      if (match) {
        const score = parseInt(match[1], 10);
        if (isValidScore(score)) return score;
      }
    } catch { /* ignore */ }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Credit Score Worker
// ---------------------------------------------------------------------------

export class CreditScoreWorker {
  private readonly _workerId: number;
  private readonly _fingerprintRotator: FingerprintRotator;
  private readonly _ssnFlow: SSNFlowManager;
  private readonly _browserPool: BrowserPool;
  private readonly _safeTestMode: boolean;
  private readonly _proxyCountry: string | undefined;
  private _running = false;
  private _activeBrowser = false;

  constructor(opts: {
    workerId: number;
    safeTestMode?: boolean;
    proxyCountry?: string;
    browserPool?: BrowserPool;
  }) {
    this._workerId = opts.workerId;
    this._fingerprintRotator = new FingerprintRotator();
    this._ssnFlow = new SSNFlowManager();
    this._safeTestMode = opts.safeTestMode ?? !ENV.evomiUsername;
    this._proxyCountry = opts.proxyCountry;
    this._browserPool = opts.browserPool ?? getBrowserPool();
  }

  get workerId(): number { return this._workerId; }
  get isRunning(): boolean { return this._running; }

  /**
   * Process a single job (entry point from WorkerPool).
   */
  async processJob(job: JobRequest): Promise<JobResult> {
    const startTime = Date.now();
    let proxyLeaseId: string | undefined;
    let proxyIp: string | null = null;

    try {
      this._running = true;

      if (this._safeTestMode) {
        return this._processSafeMode(job, startTime);
      }

      const proxyOpts: ProxyAcquireOptions = {};
      if (this._proxyCountry) proxyOpts.country = this._proxyCountry;

      const lease = await acquireProxy(proxyOpts);
      if (lease) {
        proxyLeaseId = lease.leaseId;
        proxyIp = lease.assignedIp;
      }

      try {
        const result = await this._processBrowserMode(job, lease ?? null);
        return { ...result, proxyLeaseId, proxyIp, durationMs: Date.now() - startTime };
      } finally {
        if (lease) {
          await releaseProxy({ leaseId: lease.leaseId, success: true });
        }
      }
    } catch (err) {
      return {
        jobId: job.jobId,
        status: "failed",
        creditScore: null,
        productScore: null,
        dataQualityScore: null,
        status_: null,
        error: String(err),
        workerId: this._workerId,
        proxyIp,
        durationMs: Date.now() - startTime,
        needsSsn: false,
        source: "system",
        proxyLeaseId,
      };
    } finally {
      this._running = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Safe test mode
  // ---------------------------------------------------------------------------

  private _processSafeMode(job: JobRequest, startTime: number): JobResult {
    const creditScore = 450 + (this._simpleHash(job.firstName + job.lastName + job.dob) % 400);

    const oneCsResult = buildOneCsResult({
      creditScore,
      completenessScore: 0.75,
      adverseReasons: [],
      source: "testbench",
    });

    return {
      jobId: job.jobId,
      status: "succeeded",
      creditScore,
      productScore: oneCsResult.productScore,
      dataQualityScore: oneCsResult.dataQualityScore,
      status_: oneCsResult.status,
      error: null,
      workerId: this._workerId,
      proxyIp: null,
      durationMs: Date.now() - startTime,
      needsSsn: false,
      source: "testbench",
      explanations: oneCsResult.explanations,
    };
  }

  // ---------------------------------------------------------------------------
  // Browser mode — 3-step form flow (adapted from cs_worker.py)
  // ---------------------------------------------------------------------------

  private async _processBrowserMode(
    job: JobRequest,
    lease: Awaited<ReturnType<typeof acquireProxy>> | null,
  ): Promise<JobResult> {
    if (!ENV.evomiUsername) {
      return {
        jobId: job.jobId,
        status: "failed",
        creditScore: null,
        productScore: null,
        dataQualityScore: null,
        status_: null,
        error: "Evomi credentials not configured",
        workerId: this._workerId,
        proxyIp: null,
        durationMs: null,
        needsSsn: false,
        source: "system",
      };
    }

    const fingerprint = this._fingerprintRotator.generate();
    const proxyUrl = lease ? this._buildProxyUrl(lease) : null;

    const acquired = await this._browserPool.acquire(fingerprint, proxyUrl, this._proxyCountry);
    this._activeBrowser = true;

    try {
      // Inject anti-fingerprint noise (run before navigation)
      await injectThreatMetrixNoisePost(acquired.page);

      // Warm up
      await acquired.page.goto("about:blank");
      await warmUpPage(acquired.page);

      // Navigate to funnel start
      await acquired.page.goto(UC_FUNNEL_URL, {
        waitUntil: "domcontentloaded",
        timeout: FORM_TIMEOUT_MS,
      });
      await warmUpPage(acquired.page);

      // Inject CSS to hide automation indicators
      await acquired.page.addStyleTag({
        content: `
          [data-webby-wrap] { display: none !important; }
          #webby_extension { display: none !important; }
        `,
      });

      // Step 1: Personal information
      await this._fillStep1(acquired.page, job);
      await this._clickContinue(acquired.page);

      // Wait for step 2 (income)
      await this._waitForStep(acquired.page, "income", STEP_TIMEOUT_MS);

      // Step 2: Income
      await this._fillStep2(acquired.page, job);
      await this._clickContinue(acquired.page);

      // Wait for step 3 (login)
      await this._waitForStep(acquired.page, "login", STEP_TIMEOUT_MS);

      // Step 3: Create account
      const email = job.email ?? randomEmail();
      await this._fillStep3(acquired.page, email);

      // Submit form
      await this._submitForm(acquired.page);

      // Wait for result page (adverse-page or offer-page)
      const resultUrl = await this._waitForResult(acquired.page, FORM_TIMEOUT_MS);

      // Extract score
      if (resultUrl.includes("adverse-page") || resultUrl.includes("offer-page")) {
        return await this._extractScore(acquired.page, job, acquired.proxyUrl);
      }

      return {
        jobId: job.jobId,
        status: "failed",
        creditScore: null,
        productScore: null,
        dataQualityScore: null,
        status_: null,
        error: `Form did not advance past login. URL: ${resultUrl}`,
        workerId: this._workerId,
        proxyIp: acquired.proxyUrl,
        durationMs: null,
        needsSsn: false,
        source: "api",
      };
    } finally {
      this._activeBrowser = false;
      this._browserPool.release(acquired);
    }
  }

  // ---------------------------------------------------------------------------
  // Form filling — Step 1: Personal information
  // ---------------------------------------------------------------------------

  private async _fillStep1(page: Page, job: JobRequest): Promise<void> {
    // First name
    const firstNameField = page.locator("[name='borrowerFirstName']").first();
    if (await firstNameField.isVisible()) {
      await humanType(page, "[name='borrowerFirstName']", job.firstName);
    }

    // Last name
    const lastNameField = page.locator("[name='borrowerLastName']").first();
    if (await lastNameField.isVisible()) {
      await humanType(page, "[name='borrowerLastName']", job.lastName);
    }

    // Address (geosuggest autocomplete — mirrors cs_worker.py _fill_address)
    await this._fillAddress(page, job);

    // Date of birth
    await this._fillDob(page, job.dob);

    // Phone (optional — mirrors cs_worker.py _fill_phone_if_present)
    if (job.phone) {
      await this._fillPhoneIfPresent(page, job.phone);
    }
  }

  private async _fillAddress(page: Page, job: JobRequest): Promise<void> {
    const addrSel = "[name='borrowerStreet'], #geosuggest__input--borrowerStreet, [id*='geosuggest'], [placeholder*='address' i]";
    const addrField = page.locator(addrSel).first();

    if (!await addrField.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Fallback: try to find any text input near "street" label
      const inputs = await page.locator("input").all();
      for (const inp of inputs) {
        const hint = await inp.getAttribute("hint").catch(() => null) ?? "";
        const label = await inp.getAttribute("aria-label").catch(() => null) ?? "";
        const placeholder = (await inp.getAttribute("placeholder").catch(() => null) ?? "").toLowerCase();
        if (hint.toLowerCase().includes("street") || label.toLowerCase().includes("street") || placeholder.includes("street")) {
          await this._fillAddressField(page, inp, job);
          return;
        }
      }
      throw new Error("Address field not found");
    }

    await this._fillAddressField(page, addrField, job);
  }

  private async _fillAddressField(page: Page, field: import("playwright").Locator, job: JobRequest): Promise<void> {
    await field.click();
    await humanDelay(300, 600);
    await field.fill("");
    await new Promise(r => setTimeout(r, 200));

    const searchText = `${job.street} ${job.zipCode}`;
    for (const char of searchText) {
      await field.type(char, { delay: 0 });
      await typingDelay(char);
    }

    // Wait for autocomplete suggestions
    await new Promise(r => setTimeout(r, 2000));

    // Select first suggestion matching the state
    const suggestions = page.locator(
      ".geosuggest__suggests li, [class*='suggest'] li, [class*='autocomplete'] li, [class*='dropdown'] li, [class*='menu'] li",
    );
    const count = await suggestions.count();

    let selected = false;
    for (let i = 0; i < count; i++) {
      const text = (await suggestions.nth(i).textContent().catch(() => "")) ?? "";
      if (text.toUpperCase().includes(job.state.toUpperCase())) {
        await suggestions.nth(i).click();
        selected = true;
        break;
      }
    }

    if (!selected && count > 0) {
      await suggestions.first().click();
    }

    await humanDelay(500, 1000);

    // Verify/fill city, state, zip if they appeared as separate fields
    for (const [name, value] of [
      ["borrowerCity", job.city],
      ["borrowerState", job.state],
      ["borrowerZipCode", job.zipCode],
    ] as const) {
      const el = page.locator(`[name='${name}']`).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        const current = await el.inputValue().catch(() => "");
        if (!current.trim()) {
          await humanType(page, `[name='${name}']`, value);
        }
      }
    }
  }

  private async _fillDob(page: Page, dob: string): Promise<void> {
    // Try single field first
    const dobField = page.locator("[name='borrowerDateOfBirth']").first();
    if (await dobField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await humanType(page, "[name='borrowerDateOfBirth']", dob);
      return;
    }

    // Fragmented DOB (MM / DD / YYYY)
    const parts = dob.split("/");
    if (parts.length !== 3) return;

    const [mm, dd, yyyy] = parts;
    const labels = ["month", "day", "year"];
    const values = [mm, dd, yyyy];

    for (let i = 0; i < labels.length; i++) {
      const el = page.locator(
        `[aria-label*='${labels[i]}' i], [placeholder*='${labels[i]}' i], [hint*='${labels[i]}' i]`,
      ).first();

      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        await el.click();
        await humanDelay(100, 300);
        await el.fill(values[i]);
        await humanDelay(100, 200);
      }
    }
  }

  private async _fillPhoneIfPresent(page: Page, phone: string): Promise<void> {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return;

    const area = digits.slice(0, 3);
    const first3 = digits.slice(3, 6);
    const last4 = digits.slice(6, 10);

    // Try 3-fragment phone fields
    for (const [hintText, value] of [
      ["area code", area],
      ["first 3", first3],
      ["last 4", last4],
    ] as const) {
      const el = page.locator(
        `[aria-label*='${hintText}' i], [placeholder*='${hintText}' i], [hint*='${hintText}' i]`,
      ).first();

      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        await el.click();
        await humanDelay(100, 250);
        await el.fill(value);
      }
    }

    // Fallback: single phone field
    const single = page.locator("[name='borrowerPhoneNumber'], [name='phone']").first();
    if (await single.isVisible({ timeout: 1000 }).catch(() => false)) {
      await humanType(page, "[name='borrowerPhoneNumber']", digits.slice(0, 10));
    }
  }

  // ---------------------------------------------------------------------------
  // Form filling — Step 2: Income
  // ---------------------------------------------------------------------------

  private async _fillStep2(page: Page, job: JobRequest): Promise<void> {
    const incomeField = page.locator("[name='borrowerIncome']").first();
    if (await incomeField.isVisible({ timeout: 5000 }).catch(() => false)) {
      await humanType(page, "[name='borrowerIncome']", job.annualIncome);
      return;
    }

    // Fallback: first number input on page
    const inputs = page.locator("input[type='number'], input[inputmode='numeric']");
    if (await inputs.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await inputs.first().fill(job.annualIncome);
    }
  }

  // ---------------------------------------------------------------------------
  // Form filling — Step 3: Create account
  // ---------------------------------------------------------------------------

  private async _fillStep3(page: Page, email: string): Promise<void> {
    const emailField = page.locator("[name='username'], [name='email'], [type='email']").first();
    if (await emailField.isVisible({ timeout: 5000 }).catch(() => false)) {
      await humanType(page, "[name='username'], [name='email']", email);
    }

    await humanDelay(300, 700);

    const passwordField = page.locator("[name='password'], [type='password']").first();
    if (await passwordField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await humanType(page, "[name='password'], [type='password']", ACCOUNT_PASSWORD);
    }

    await humanDelay(400, 800);

    // Check agreements checkbox
    const checkbox = page.locator("[name='agreements'], [type='checkbox']").first();
    if (await checkbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      const checked = await checkbox.isChecked().catch(() => false);
      if (!checked) {
        await checkbox.click();
        await humanDelay(200, 500);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------

  private async _clickContinue(page: Page): Promise<void> {
    const btn = page.locator(
      "button:has-text('Continue'), button[type='submit']:has-text('Continue'), input[type='submit'][value*='Continue' i]",
    ).first();

    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await humanClick(page, "button:has-text('Continue')");
    } else {
      await page.keyboard.press("Enter");
    }
    await humanDelay(500, 1500);
  }

  private async _submitForm(page: Page): Promise<void> {
    const btn = page.locator(
      "button:has-text('Check Your Rate'), button[type='submit']:has-text('Check'), button[type='submit']",
    ).first();

    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await humanClick(page, "button:has-text('Check Your Rate')");
    } else {
      await page.keyboard.press("Enter");
    }

    // Wait for ThreatMetrix overlay (mirrors cs_worker.py _submit_form)
    await new Promise(r => setTimeout(r, 3000));

    for (let i = 0; i < 60; i++) {
      const overlayVisible = await page.evaluate(() => {
        const el = document.getElementById("sec-overlay");
        return el && el.offsetParent !== null;
      }).catch(() => false);

      if (!overlayVisible) break;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  private async _waitForStep(page: Page, stepName: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const url = page.url();
      if (url.includes(`step=${stepName}`)) return;
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error(`Step '${stepName}' did not appear within ${timeoutMs}ms. URL: ${page.url()}`);
  }

  private async _waitForResult(page: Page, timeoutMs: number): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const url = page.url();
      if (url.includes("adverse-page") || url.includes("offer-page")) {
        return url;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    return page.url();
  }

  // ---------------------------------------------------------------------------
  // Score extraction from Adverse Action Notice PDF
  // ---------------------------------------------------------------------------

  private async _extractScore(page: Page, job: JobRequest, proxyIp: string | null): Promise<JobResult> {
    // Navigate to Documents portal
    await page.goto(UC_DOCUMENTS_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await new Promise(r => setTimeout(r, 5000));

    // Wait for Adverse Action Notice to appear (up to 45s)
    let adverseAppeared = false;
    for (let i = 0; i < 45; i++) {
      const hasAdverse = await page.evaluate(() =>
        Array.from(document.querySelectorAll("*")).some(
          el => el.textContent?.toLowerCase().includes("adverse action"),
        ),
      ).catch(() => false);

      if (hasAdverse) {
        adverseAppeared = true;
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!adverseAppeared) {
      return {
        jobId: job.jobId,
        status: "failed",
        creditScore: null,
        productScore: null,
        dataQualityScore: null,
        status_: null,
        error: "Adverse Action Notice not found in Documents portal",
        workerId: this._workerId,
        proxyIp,
        durationMs: null,
        needsSsn: false,
        source: "api",
      };
    }

    // Download Adverse Action PDF
    const pdfData = await this._downloadAdverseActionPdf(page);

    if (pdfData === null) {
      return {
        jobId: job.jobId,
        status: "failed",
        creditScore: null,
        productScore: null,
        dataQualityScore: null,
        status_: null,
        error: "Could not download Adverse Action Notice PDF",
        workerId: this._workerId,
        proxyIp,
        durationMs: null,
        needsSsn: false,
        source: "api",
      };
    }

    // Extract score from PDF
    const score = await extractScoreFromPdfBytes(pdfData);

    if (score !== null) {
      const oneCsResult = buildOneCsResult({
        creditScore: score,
        completenessScore: 0.85,
        adverseReasons: [],
        source: "api",
      });

      return {
        jobId: job.jobId,
        status: "succeeded",
        creditScore: score,
        productScore: oneCsResult.productScore,
        dataQualityScore: oneCsResult.dataQualityScore,
        status_: oneCsResult.status,
        error: null,
        workerId: this._workerId,
        proxyIp,
        durationMs: null,
        needsSsn: false,
        source: "api",
        explanations: oneCsResult.explanations,
        pdfPath: `adverse_action_${job.jobId}.pdf`,
      };
    }

    return {
      jobId: job.jobId,
      status: "failed",
      creditScore: null,
      productScore: null,
      dataQualityScore: null,
      status_: null,
      error: "PDF downloaded but credit score not found in text",
      workerId: this._workerId,
      proxyIp,
      durationMs: null,
      needsSsn: false,
      source: "api",
      pdfPath: `adverse_action_${job.jobId}.pdf`,
    };
  }

  private async _downloadAdverseActionPdf(page: Page): Promise<Uint8Array | null> {
    // Strategy: set up response interceptor, then click the download button
    let pdfBytes: Uint8Array | null = null;

    const responsePromise = page.waitForResponse(
      resp => {
        const ct = resp.headers()["content-type"] ?? "";
        return ct.includes("pdf") || resp.url().endsWith(".pdf");
      },
      { timeout: 30_000 },
    ).catch(() => null);

    // Find and click the Adverse Action download button
    const dlBtn = page.locator("button, a, [class*='download'], svg").filter({
      hasText: /adverse action/i,
    }).first();

    const btnVisible = await dlBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (btnVisible) {
      // Click and wait for PDF response
      await dlBtn.click();
      const resp = await responsePromise;
      if (resp) {
        const buffer = await resp.body();
        if (buffer && buffer.byteLength > 4 && new Uint8Array(buffer.slice(0, 4))[0] === 0x25) {
          // %PDF magic bytes
          pdfBytes = new Uint8Array(buffer);
        }
      }
    }

    if (!pdfBytes) {
      // Fallback: find download button via JavaScript evaluation
      const dlEl = await page.evaluateHandle(`
        () => {
          const rows = Array.from(document.querySelectorAll('li, tr, [class*="row"], [class*="item"], [class*="document"]'));
          for (const row of rows) {
            if (row.textContent.toLowerCase().includes('adverse action')) {
              const btn = row.querySelector('a[href], button, [class*="download"], svg');
              if (btn) return btn;
            }
          }
          // Fallback: any link near "adverse action" text
          const allLinks = Array.from(document.querySelectorAll('a, button'));
          for (const link of allLinks) {
            const parent = link.closest('li, tr, div');
            if (parent && parent.textContent.toLowerCase().includes('adverse action')) {
              return link;
            }
          }
          return null;
        }
      `).catch(() => null);

      if (dlEl) {
        try {
          const el = dlEl.asElement();
          if (el) {
            await (el as import("playwright").ElementHandle).click();
            await new Promise(r => setTimeout(r, 5000));
            const resp = await responsePromise;
            if (resp) {
              const buffer = await resp.body();
              if (buffer && buffer.byteLength > 4 && new Uint8Array(buffer.slice(0, 4))[0] === 0x25) {
                pdfBytes = new Uint8Array(buffer);
              }
            }
          }
        } catch { /* ignore */ }
      }
    }

    return pdfBytes;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private _buildProxyUrl(lease: NonNullable<Awaited<ReturnType<typeof acquireProxy>>>): string {
    if (lease.provider === "evomi") {
      const country = lease.country ? `_country-${lease.country}` : "";
      return `http://${lease.username}:${lease.password}${country}@${lease.host}:${lease.port}`;
    }
    return `http://${lease.username}:${lease.password}@${lease.host}:${lease.port}`;
  }

  private _simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

// ---------------------------------------------------------------------------
// Worker Pool
// ---------------------------------------------------------------------------

export type WorkerPoolEvent =
  | { type: "job.queued"; jobId: string; queueSize: number }
  | { type: "job.started"; jobId: string; workerId: number }
  | { type: "job.completed"; jobId: string; creditScore: number | null; durationMs: number | null }
  | { type: "job.failed"; jobId: string; error: string }
  | { type: "worker.started"; workerId: number }
  | { type: "worker.error"; workerId: number; error: string };

export type WorkerPoolEventsHandler = (event: WorkerPoolEvent) => void | Promise<void>;

export class WorkerPool {
  private readonly _workers: CreditScoreWorker[] = [];
  private readonly _jobQueue: Array<{
    job: JobRequest;
    resolve: (result: JobResult) => void;
    reject: (err: Error) => void;
  }> = [];
  private readonly _running: boolean[] = [];
  private readonly _numWorkers: number;
  private readonly _safeTestMode: boolean;
  private readonly _proxyCountry: string | undefined;
  private readonly _onEvent?: WorkerPoolEventsHandler;
  private _started = false;
  private _browserPool: BrowserPool;

  constructor(config: WorkerEngineConfig = {}) {
    this._numWorkers = config.numWorkers ?? 2;
    this._safeTestMode = config.safeTestMode ?? !ENV.evomiUsername;
    this._proxyCountry = config.proxyCountry;
    this._onEvent = config.onEvent;
    this._browserPool = getBrowserPool({ headless: config.headless ?? true });
  }

  async start(): Promise<void> {
    if (this._started) return;
    this._started = true;

    for (let i = 0; i < this._numWorkers; i++) {
      this._workers.push(
        new CreditScoreWorker({
          workerId: i,
          safeTestMode: this._safeTestMode,
          proxyCountry: this._proxyCountry,
          browserPool: this._browserPool,
        }),
      );
      this._running.push(false);
      this._dispatch({ type: "worker.started", workerId: i });
    }

    // Start worker coroutines
    for (let i = 0; i < this._numWorkers; i++) {
      void this._workerLoop(i);
    }
  }

  async stop(): Promise<void> {
    this._started = false;
    for (let i = 0; i < this._running.length; i++) {
      this._running[i] = false;
    }
    await this._browserPool.shutdown();
  }

  /**
   * Submit a job and wait for result.
   */
  submit(job: JobRequest): Promise<JobResult> {
    return new Promise<JobResult>((resolve, reject) => {
      this._jobQueue.push({ job, resolve, reject });
      this._dispatch({ type: "job.queued", jobId: job.jobId, queueSize: this._jobQueue.length });
    });
  }

  get queueSize(): number {
    return this._jobQueue.length;
  }

  get activeWorkers(): number {
    return this._running.filter(Boolean).length;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async _workerLoop(workerId: number): Promise<void> {
    this._running[workerId] = true;

    while (this._started && this._running[workerId]) {
      // Find next job in queue
      const entry = this._jobQueue.shift();
      if (!entry) {
        // No jobs, wait briefly and check again
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      const { job, resolve, reject } = entry;

      try {
        this._dispatch({ type: "job.started", jobId: job.jobId, workerId });
        const result = await this._workers[workerId].processJob(job);
                if (result.status === "succeeded") {
          this._dispatch({
            type: "job.completed",
            jobId: job.jobId,
            creditScore: result.creditScore,
            durationMs: result.durationMs,
          });
        } else {
          this._dispatch({
            type: "job.failed",
            jobId: job.jobId,
            error: result.error ?? "unknown",
          });
        }
        resolve(result);
      } catch (err) {
        this._dispatch({ type: "job.failed", jobId: job.jobId, error: String(err) });
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  private _dispatch(event: WorkerPoolEvent): void {
    try {
      this._onEvent?.(event);
    } catch (err) {
      console.error("[WorkerPool] Event handler error:", err);
    }
  }
}

// ---------------------------------------------------------------------------
// Global singleton engine
// ---------------------------------------------------------------------------

let _globalEngine: WorkerPool | null = null;

export function getWorkerEngine(config?: WorkerEngineConfig): WorkerPool {
  if (!_globalEngine) {
    _globalEngine = new WorkerPool(config);
  }
  return _globalEngine;
}

export async function startWorkerEngine(config?: WorkerEngineConfig): Promise<WorkerPool> {
  if (_globalEngine) {
    await _globalEngine.stop();
  }
  _globalEngine = new WorkerPool(config);
  await _globalEngine.start();
  return _globalEngine;
}

export async function stopWorkerEngine(): Promise<void> {
  if (_globalEngine) {
    await _globalEngine.stop();
    _globalEngine = null;
  }
}