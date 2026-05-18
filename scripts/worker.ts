/**
 * scripts/worker.ts
 *
 * ONE CS browser automation worker.
 * Polls the API for queued jobs and executes them via Playwright browser.
 *
 * Usage:
 *   PRIVATE_API_KEY=test123 pnpm worker        # dev with tsx
 *   node dist/worker.js                        # production
 *
 * Environment:
 *   API_BASE          — API base URL (default: http://localhost:3000/api/v1)
 *   WORKER_API_KEY    — Bearer token for API auth
 *   WORKER_ID         — Worker identifier (default: worker-1)
 *   POLL_INTERVAL_MS  — Poll interval (default: 5000)
 *   EVOMI_USERNAME    — Evomi proxy username
 *   EVOMI_PASSWORD    — Evomi proxy password
 *   EVOMI_HOST        — Evomi proxy host
 *   EVOMI_PORT        — Evomi proxy port
 *   MAX_CONCURRENCY   — Max concurrent browser sessions (default: 2)
 */

import "dotenv/config";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_BASE = process.env.API_BASE || "http://localhost:3000/api/v1";
const API_KEY = process.env.WORKER_API_KEY || process.env.PRIVATE_API_KEY || "";
const WORKER_ID = process.env.WORKER_ID || "worker-1";
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "5000", 10);
const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY || "2", 10);
const HEADLESS = process.env.HEADLESS !== "false";

// Browser config
const BROWSER_TIMEOUT_MS = 60_000;
const FORM_STEP_TIMEOUT_MS = 30_000;
const UC_FUNNEL_URL = "https://www.universal-credit.com/funnel/personal-information-1/DEBT_CONSOLIDATION/5000?step=contact";
const ACCOUNT_PASSWORD = "Secure#Pass2025!";

// ---------------------------------------------------------------------------
// Types (mirrors server/workerEngine/csWorkerEngine.ts)
// ---------------------------------------------------------------------------

interface JobRequest {
  jobId: string;
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  dob: string;
  annualIncome: string;
  ssn?: string;
  email?: string;
  phone?: string;
  telegramChatId?: string;
  telegramMessageId?: number;
  maxRetries?: number;
}

interface JobResult {
  jobId: string;
  status: "pending" | "running" | "succeeded" | "failed" | "waiting_ssn";
  creditScore: number | null;
  productScore: number | null;
  dataQualityScore: number | null;
  status_: "success" | "review" | "decline" | "no_file" | "error" | null;
  error: string | null;
  workerId: number | null;
  proxyIp: string | null;
  durationMs: number | null;
  needsSsn: boolean;
  source: string;
  pdfPath?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function humanDelay(min = 300, max = 600): Promise<void> {
  return sleep(min + Math.random() * (max - min));
}

function typingDelay(_char: string): Promise<void> {
  return sleep(20 + Math.random() * 40);
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...options.headers,
    },
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

async function pollForJob(): Promise<{ publicId: string; payloadJson: JobRequest; queueName: string } | null> {
  try {
    const data = await apiFetch(`/queue/next?workerId=${WORKER_ID}`);
    if (!data.ok) return null;
    if (!data.data?.job) return null;
    const job = data.data.job;
    return {
      publicId: job.publicId,
      payloadJson: job.payload,
      queueName: job.queueName || "default",
    };
  } catch {
    return null;
  }
}

async function markJobStart(publicId: string): Promise<void> {
  try {
    await apiFetch(`/jobs/${publicId}/start`, {
      method: "PUT",
      body: JSON.stringify({ workerId: WORKER_ID }),
    });
  } catch { /* best effort */ }
}

async function markJobComplete(
  publicId: string,
  success: boolean,
  result?: Partial<JobResult>,
  error?: string,
): Promise<void> {
  try {
    await apiFetch(`/jobs/${publicId}/complete`, {
      method: "PUT",
      body: JSON.stringify({ success, result, error }),
    });
  } catch { /* best effort */ }
}

// ---------------------------------------------------------------------------
// Browser automation — Credit Score Worker
// ---------------------------------------------------------------------------

async function buildProxyUrl(): Promise<string | null> {
  const host = process.env.EVOMI_HOST || process.env.PROXY_HOST;
  const port = process.env.EVOMI_PORT || process.env.PROXY_PORT;
  const user = process.env.EVOMI_USERNAME || process.env.PROXY_USER;
  const pass = process.env.EVOMI_PASSWORD || process.env.PROXY_PASS;

  if (!host || !port) return null;
  if (!user || !pass) return `http://${host}:${port}`;
  return `http://${user}:${pass}@${host}:${port}`;
}

async function fillAddressField(page: Page, job: JobRequest): Promise<void> {
  const selectors = [
    "[name='borrowerStreet']",
    "#geosuggest__input--borrowerStreet",
    "[placeholder*='address' i]",
    "[aria-label*='street' i]",
  ];

  for (const sel of selectors) {
    const field = page.locator(sel).first();
    if (await field.isVisible({ timeout: 2000 }).catch(() => false)) {
      await field.click();
      await humanDelay(300, 600);
      await field.fill("");
      await sleep(200);

      const searchText = `${job.street} ${job.zipCode}`;
      for (const char of searchText) {
        await field.type(char, { delay: 0 });
        await typingDelay(char);
      }
      await sleep(2000);

      // Select first suggestion matching state
      const suggestions = page.locator(
        ".geosuggest__suggests li, [class*='suggest'] li, [class*='autocomplete'] li, [class*='menu'] li",
      ).first();
      if (await suggestions.isVisible({ timeout: 2000 }).catch(() => false)) {
        await suggestions.click();
        await humanDelay(500, 1000);
      }

      // Fill city/state/zip if separate fields appeared
      for (const [name, value] of [
        ["borrowerCity", job.city],
        ["borrowerState", job.state],
        ["borrowerZipCode", job.zipCode],
      ] as const) {
        const el = page.locator(`[name='${name}']`).first();
        if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
          const current = await el.inputValue().catch(() => "");
          if (!current.trim()) {
            await el.fill(value);
          }
        }
      }
      return;
    }
  }
  throw new Error("Address field not found");
}

async function fillDob(page: Page, dob: string): Promise<void> {
  const dobField = page.locator("[name='borrowerDateOfBirth']").first();
  if (await dobField.isVisible({ timeout: 2000 }).catch(() => false)) {
    await dobField.click();
    await humanDelay();
    await dobField.fill(dob);
    return;
  }

  // Fragmented MM/DD/YYYY
  const parts = dob.split("/");
  const labels = ["month", "day", "year"];
  for (let i = 0; i < labels.length; i++) {
    const el = page.locator(
      `[aria-label*='${labels[i]}' i], [placeholder*='${labels[i]}' i]`,
    ).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
      await el.fill(parts[i]);
    }
  }
}

async function fillPhone(page: Page, phone: string): Promise<void> {
  const digits = phone.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 10) return;

  const area = digits.slice(0, 3);
  const first3 = digits.slice(3, 6);
  const last4 = digits.slice(6, 10);

  for (const [hint, value] of [
    ["area code", area],
    ["first 3", first3],
    ["last 4", last4],
  ] as const) {
    const el = page.locator(
      `[aria-label*='${hint}' i], [placeholder*='${hint}' i]`,
    ).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
      await el.fill(value);
    }
  }

  // Fallback: single phone field
  const single = page.locator("[name='borrowerPhoneNumber'], [name='phone']").first();
  if (await single.isVisible({ timeout: 1000 }).catch(() => false)) {
    await single.fill(digits);
  }
}

async function clickContinue(page: Page): Promise<void> {
  const btn = page.locator(
    "button[type='submit'], button:has-text('Continue'), button:has-text('Next'), button:has-text('Submit')",
  ).first();
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btn.click();
  }
}

async function waitForStep(page: Page, step: string, timeoutMs: number): Promise<void> {
  const selectors: Record<string, string[]> = {
    income: ["[name='borrowerIncome']", "input[type='number']", "[placeholder*='income' i]"],
    login: ["[name='username']", "[name='email']", "[placeholder*='email' i]", "[placeholder*='login' i]"],
  };

  const targets = selectors[step] || [];
  for (const sel of targets) {
    if (await page.locator(sel).first().isVisible({ timeout: timeoutMs }).catch(() => false)) {
      return;
    }
  }
  await sleep(timeoutMs); // Fallback wait
}

async function extractScoreFromPage(page: Page): Promise<number | null> {
  // Try multiple extraction patterns
  const patterns = [
    () => page.locator("[data-testid='credit-score'], [data-score]").first().textContent().catch(() => null),
    () => page.locator(".score-value, [class*='score']").first().textContent().catch(() => null),
    () => page.locator("body").textContent().catch(() => null),
  ];

  for (const pattern of patterns) {
    const text = await pattern();
    if (!text) continue;

    // Check for direct number
    const direct = parseInt(text.replace(/\D/g, "").slice(0, 3), 10);
    if (direct >= 300 && direct <= 850) return direct;

    // Regex for 3-digit scores
    const match = String(text).match(/\b(3\d{2}|4\d{2}|5\d{2}|6\d{2}|7\d{2}|8[0-4]\d|850)\b/);
    if (match) {
      const score = parseInt(match[1], 10);
      if (score >= 300 && score <= 850) return score;
    }
  }

  return null;
}

function buildScoreResult(jobId: string, score: number, proxyIp: string | null): JobResult {
  const dqs = Math.round((score / 850) * 10 * 10) / 10;
  const productScore = Math.min(20, Math.max(1, Math.round(dqs * 2)));
  const status: JobResult["status_"] =
    score >= 700 ? "success" : score >= 580 ? "review" : "decline";

  return {
    jobId,
    status: "succeeded",
    creditScore: score,
    productScore,
    dataQualityScore: dqs,
    status_,
    error: null,
    workerId: 0,
    proxyIp,
    durationMs: null,
    needsSsn: false,
    source: "browser",
  };
}

async function executeBrowserJob(job: JobRequest): Promise<JobResult> {
  const proxyUrl = await buildProxyUrl();
  const browser = await chromium.launch({ headless: HEADLESS, timeout: 30_000 });

  try {
    const contextOptions: Parameters<typeof browser.newContext>[0] = {
      viewport: { width: 1920, height: 1080 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      locale: "en-US",
      timezoneId: "America/New_York",
    };

    if (proxyUrl) {
      contextOptions.proxy = { server: proxyUrl };
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    try {
      // Navigate to funnel
      await page.goto(UC_FUNNEL_URL, {
        waitUntil: "domcontentloaded",
        timeout: BROWSER_TIMEOUT_MS,
      });
      await sleep(2000);

      // Step 1: Personal information
      const firstNameVisible = await page
        .locator("[name='borrowerFirstName']")
        .first()
        .isVisible({ timeout: FORM_STEP_TIMEOUT_MS })
        .catch(() => false);

      if (!firstNameVisible) {
        return {
          jobId: job.jobId,
          status: "failed",
          creditScore: null,
          productScore: null,
          dataQualityScore: null,
          status_: "error",
          error: "Form fields not visible — page blocked by anti-bot or wrong URL",
          workerId: 0,
          proxyIp: proxyUrl ?? null,
          durationMs: null,
          needsSsn: false,
          source: "browser",
        };
      }

      await page.locator("[name='borrowerFirstName']").first().fill(job.firstName);
      await page.locator("[name='borrowerLastName']").first().fill(job.lastName);
      await fillAddressField(page, job);
      await fillDob(page, job.dob);
      if (job.phone) await fillPhone(page, job.phone);

      await clickContinue(page);
      await waitForStep(page, "income", FORM_STEP_TIMEOUT_MS);

      // Step 2: Income
      const incomeField = page.locator("[name='borrowerIncome']").first();
      if (await incomeField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await incomeField.fill(job.annualIncome);
      }
      await clickContinue(page);
      await waitForStep(page, "login", FORM_STEP_TIMEOUT_MS);

      // Step 3: Create account
      const email = job.email || `${job.firstName.toLowerCase()}.${job.lastName.toLowerCase()}${Date.now()}@gmail.com`;
      const emailField = page.locator("[name='username'], [name='email'], [type='email']").first();
      if (await emailField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await emailField.fill(email);
      }

      const passwordField = page.locator("[name='password'], [type='password']").first();
      if (await passwordField.isVisible({ timeout: 2000 }).catch(() => false)) {
        await passwordField.fill(ACCOUNT_PASSWORD);
      }

      // Submit form
      const submitBtn = page.locator(
        "button[type='submit'], button:has-text('Submit'), button:has-text('Get My Score')",
      ).first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click();
      }

      // Wait for result
      await sleep(5000);

      // Check for result page
      const url = page.url();
      if (url.includes("adverse-page") || url.includes("offer-page") || url.includes("result")) {
        const score = await extractScoreFromPage(page);
        if (score !== null) {
          return buildScoreResult(job.jobId, score, proxyUrl);
        }
      }

      // Try one more time after additional wait
      await sleep(3000);
      const score2 = await extractScoreFromPage(page);
      if (score2 !== null) {
        return buildScoreResult(job.jobId, score2, proxyUrl);
      }

      return {
        jobId: job.jobId,
        status: "failed",
        creditScore: null,
        productScore: null,
        dataQualityScore: null,
        status_: "error",
        error: `No credit score found on result page. URL: ${url}`,
        workerId: 0,
        proxyIp: proxyUrl ?? null,
        durationMs: null,
        needsSsn: false,
        source: "browser",
      };
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Worker loop
// ---------------------------------------------------------------------------

async function runWorker(): Promise<void> {
  console.log(`[${WORKER_ID}] Browser automation worker starting...`);
  console.log(`[${WORKER_ID}] API: ${API_BASE}`);
  console.log(`[${WORKER_ID}] Headless: ${HEADLESS}`);
  console.log(`[${WORKER_ID}] Proxy: ${process.env.EVOMI_HOST || "none"}`);
  console.log(`[${WORKER_ID}] Max concurrency: ${MAX_CONCURRENCY}`);

  let activeCount = 0;

  while (true) {
    if (activeCount >= MAX_CONCURRENCY) {
      await sleep(1000);
      continue;
    }

    const jobData = await pollForJob();

    if (!jobData) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    const { publicId, payloadJson } = jobData;
    activeCount++;

    // Process in background
    (async () => {
      try {
        console.log(`[${WORKER_ID}] Processing job: ${publicId}`);
        await markJobStart(publicId);

        const startMs = Date.now();
        const result = await executeBrowserJob(payloadJson);
        const durationMs = Date.now() - startMs;

        result.durationMs = durationMs;

        if (result.status === "succeeded") {
          await markJobComplete(publicId, true, {
            creditScore: result.creditScore,
            productScore: result.productScore,
            dataQualityScore: result.dataQualityScore,
            status_: result.status_,
            durationMs,
            source: result.source,
            proxyIp: result.proxyIp,
          });
          console.log(
            `[${WORKER_ID}] Job ${publicId} succeeded — score: ${result.creditScore} (${durationMs}ms)`,
          );
        } else {
          await markJobComplete(publicId, false, undefined, result.error || "Unknown error");
          console.log(`[${WORKER_ID}] Job ${publicId} failed: ${result.error}`);
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        await markJobComplete(publicId, false, undefined, error);
        console.error(`[${WORKER_ID}] Job ${publicId} crashed: ${error}`);
      } finally {
        activeCount--;
      }
    })();
  }
}

// ---------------------------------------------------------------------------
// Shutdown
// ---------------------------------------------------------------------------

process.on("SIGINT", () => {
  console.log(`[${WORKER_ID}] Shutting down...`);
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log(`[${WORKER_ID}] Shutting down...`);
  process.exit(0);
});

// Start
runWorker().catch(err => {
  console.error(`[${WORKER_ID}] Fatal error:`, err);
  process.exit(1);
});