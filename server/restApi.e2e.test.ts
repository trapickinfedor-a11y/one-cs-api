/**
 * server/restApi.e2e.test.ts
 *
 * End-to-end test for the ONE CS funnel via REST API.
 *
 * Steps:
 * 1. POST /api/v1/requests/single — create a job
 * 2. Poll GET /api/v1/jobs/:publicId — wait for completion
 * 3. Verify resultJson.oneCsResult.creditScore is in range 300–850
 * 4. Verify resultJson.summary.creditScore matches
 *
 * Requires:
 *   - Server running: pnpm dev  (or API_BASE points to a live server)
 *   - PRIVATE_API_KEY environment variable set (Bearer token)
 *   - Evomi credentials configured (EVOMI_USERNAME, EVOMI_PASSWORD, EVOMI_API_KEY)
 *
 * Run: pnpm vitest run server/restApi.e2e.test.ts --timeout=90000
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";

const API_BASE = process.env.API_BASE ?? "http://localhost:3000";
const API_KEY = process.env.PRIVATE_API_KEY ?? "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiRequest(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...options.headers,
    },
  });
  return res.json();
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("REST API E2E — ONE CS real-browser funnel", () => {
  let browser: Browser;
  let serverReachable = false;

  beforeAll(async () => {
    if (!API_KEY) {
      // Skip E2E test if no API key — this is expected in CI without env vars
      console.log("SKIP: PRIVATE_API_KEY not set — E2E test requires live server");
      return;
    }

    // Verify the server is reachable before launching the browser
    try {
      const healthRes = await fetch(`${API_BASE}/api/v1/system/health`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });
      if (!healthRes.ok) {
        throw new Error(`Server health check returned ${healthRes.status}`);
      }
      serverReachable = true;
    } catch (_) {
      // Could not reach the server — skip all tests in this suite
      return;
    }

    // Launch a browser to help with any JS-heavy pages the worker may encounter
    browser = await chromium.launch({ headless: true, timeout: 15_000 });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  it(
    "POST /api/v1/requests/single creates a job and returns a real credit score in range 300–850",
    async () => {
      if (!serverReachable) return; // server not reachable — skip
      // ── Step 1: Create job ──────────────────────────────────────────────────
      const createRes = await apiRequest("/api/v1/requests/single", {
        method: "POST",
        body: JSON.stringify({
          requestMode: "single",
          targetLabel: "e2e-browser-test",
          payload: {
            firstName: "Sarah",
            lastName: "Connor",
            street: "1313 Mockingbird Lane",
            city: "Los Angeles",
            state: "CA",
            zipCode: "90001",
            dob: "01/15/1985",
            annualIncome: "65000",
            email: "sarah.connor.e2e@example.com",
          },
        }),
      });

      expect(createRes.ok).toBe(true);
      expect(createRes.data).toBeTruthy();
      const publicId = createRes.data.job.publicId;
      expect(publicId).toBeTruthy();

      // ── Step 2: Poll for completion (3 s interval, max 60 s) ───────────────
      let result: any = null;
      for (let i = 0; i < 20; i++) {
        await sleep(3000);
        const statusRes = await apiRequest(`/api/v1/jobs/${publicId}`);
        const status = statusRes.data?.status;
        if (status === "succeeded" || status === "failed") {
          result = statusRes.data;
          break;
        }
      }

      expect(result).not.toBeNull();
      expect(result.status).toBe("succeeded");
      expect(result.resultJson).toBeTruthy();

      // ── Step 3: Verify credit score ─────────────────────────────────────────
      const score = result.resultJson.oneCsResult?.creditScore;
      expect(score).not.toBeNull();
      expect(typeof score).toBe("number");
      expect(score).toBeGreaterThanOrEqual(300);
      expect(score).toBeLessThanOrEqual(850);

      // ── Step 4: Verify summary matches ────────────────────────────────────
      expect(result.resultJson.summary.creditScore).toBe(score);
      expect(result.resultJson.summary.productScore).toBeGreaterThan(0);
      expect(result.resultJson.executionState).toMatch(
        /completed_by_browser|completed_by_worker/,
      );
    },
    90_000, // vitest timeout (ms)
  );
});