/**
 * Human Behavior Simulation
 *
 * Simulates realistic human-like browser interaction to minimize
 * ThreatMetrix and similar detection systems.
 *
 * Reference: legacy_research/extracted/credit_score_bot/cs_module/antidetect/human.py
 */

import type { Page } from "playwright";

export interface Point {
  x: number;
  y: number;
}

export interface BezierCurve {
  points: Point[];
  durationMs: number;
}

export interface ScrollStep {
  deltaY: number;
  sleepMs: number;
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/**
 * Random delay simulating human reaction time (300-1200ms by default).
 */
export async function humanDelay(minMs = 300, maxMs = 1200): Promise<void> {
  const delay = Math.random() * (maxMs - minMs) + minMs;
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Per-character typing delay. Spaces and punctuation are slower.
 * 7% chance of a "thinking pause" (extra 300-800ms).
 */
export async function typingDelay(char: string): Promise<void> {
  let base: number;
  if (/\s/.test(char)) {
    base = 80 + Math.random() * 120; // 80-200ms
  } else if (/[!@#$%^&*()_+\-=\[\]{}|;':",./<>?]/.test(char)) {
    base = 100 + Math.random() * 150; // 100-250ms
  } else {
    base = 50 + Math.random() * 130;  // 50-180ms
  }

  // "Thinking pause"
  if (Math.random() < 0.07) {
    base += 300 + Math.random() * 500;
  }

  await new Promise(resolve => setTimeout(resolve, base));
}

/**
 * Type text into a field with realistic per-character delays.
 */
export async function humanType(
  page: Page,
  selector: string,
  text: string,
  { clearFirst = true }: { clearFirst?: boolean } = {},
): Promise<void> {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible" });
  await el.click();
  await humanDelay(200, 500);

  if (clearFirst) {
    await el.evaluate((node: Element) => {
      (node as HTMLInputElement | HTMLTextAreaElement).select?.() ??
      (node as HTMLInputElement).setSelectionRange?.(0, (node as HTMLInputElement).value.length);
    });
    await el.press("Control+A");
    await page.keyboard.press("Backspace");
    await humanDelay(50, 150);
  }

  for (const char of text) {
    await page.keyboard.type(char, { delay: 0 });
    await typingDelay(char);
  }

  await humanDelay(100, 400);
}

// ---------------------------------------------------------------------------
// Mouse movement
// ---------------------------------------------------------------------------

/**
 * Generate cubic Bezier curve points between two coordinates.
 * Returns array of {x, y} points for smooth mouse movement.
 */
export function bezierPoints(
  x1: number, y1: number,
  x2: number, y2: number,
  steps = 20,
): Array<{ x: number; y: number }> {
  // Random control points for natural curve
  const cx1 = x1 + (Math.random() - 0.5) * 200;
  const cy1 = y1 + (Math.random() - 0.5) * 100;
  const cx2 = x2 + (Math.random() - 0.5) * 200;
  const cy2 = y2 + (Math.random() - 0.5) * 100;

  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const bx = mt ** 3 * x1 + 3 * mt ** 2 * t * cx1 + 3 * mt * t ** 2 * cx2 + t ** 3 * x2;
    const by = mt ** 3 * y1 + 3 * mt ** 2 * t * cy1 + 3 * mt * t ** 2 * cy2 + t ** 3 * y2;
    // Add micro-jitter
    points.push({ x: bx + (Math.random() - 0.5) * 2, y: by + (Math.random() - 0.5) * 2 });
  }
  return points;
}

/**
 * Move mouse along a Bezier curve from (x1,y1) to (x2,y2).
 */
export async function bezierMouseMove(
  page: Page,
  x1: number, y1: number,
  x2: number, y2: number,
  steps = 20,
): Promise<void> {
  await page.mouse.move(x1, y1);
  const points = bezierPoints(x1, y1, x2, y2, steps);
  for (const p of points) {
    await page.mouse.move(p.x, p.y);
    await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 20));
  }
}

/**
 * Click an element with realistic mouse movement.
 */
export async function humanClick(
  page: Page,
  selector: string,
): Promise<void> {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible" });
  const box = await el.boundingBox();
  if (!box) {
    await el.click();
    return;
  }

  const targetX = box.x + box.width / 2;
  const targetY = box.y + box.height / 2;

  // Start from random position
  const startX = targetX + (Math.random() - 0.5) * 400;
  const startY = targetY + (Math.random() - 0.5) * 300;
  await page.mouse.move(startX, startY);
  await humanDelay(50, 150);

  // Bezier move to target
  await bezierMouseMove(page, startX, startY, targetX, targetY, 15);
  await page.mouse.click(targetX, targetY);
}

// ---------------------------------------------------------------------------
// Page warm-up
// ---------------------------------------------------------------------------

/**
 * Simulate natural page warm-up: delay + random mouse + scroll.
 * Run after page.goto() to appear more human.
 */
export async function warmUpPage(page: Page): Promise<void> {
  await humanDelay(800, 2000);

  // Random mouse movements
  for (let i = 0; i < 2 + Math.floor(Math.random() * 4); i++) {
    const x = 100 + Math.random() * 600;
    const y = 100 + Math.random() * 400;
    await page.mouse.move(x, y);
    await humanDelay(100, 300);
  }

  // Scroll down
  await page.evaluate(() => window.scrollBy(0, 50 + Math.random() * 100));
  await humanDelay(200, 600);
  await page.evaluate(() => window.scrollBy(0, -(30 + Math.random() * 70)));
  await humanDelay(500, 1500);
}

// ---------------------------------------------------------------------------
// Anti-fingerprint injection
// ---------------------------------------------------------------------------

/**
 * Inject ThreatMetrix noise to defeat canvas, audio, WebGL, battery, and permissions fingerprinting.
 * This runs as an init script (before any page JS executes).
 */
export function buildThreatMetrixNoiseScript(): string {
  return `
(function() {
  // --- Canvas noise ---
  const _origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function() {
    const ctx = this.getContext('2d');
    if (ctx) {
      const imageData = ctx.getImageData(0, 0, this.width, this.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const idx = Math.floor(Math.random() * 3);
        data[idx] = data[idx] ^ (Math.floor(Math.random() * 3) > 0 ? 0 : 1);
      }
      ctx.putImageData(imageData, 0, 0);
    }
    return _origToDataURL.apply(this, arguments);
  };

  // --- WebGL readPixels noise ---
  const _origReadPixels = WebGLRenderingContext.prototype.readPixels;
  WebGLRenderingContext.prototype.readPixels = function(...args) {
    const result = _origReadPixels.apply(this, args);
    if (Math.random() < 0.05) {
      // Rare 1-bit noise
      const buf = args[args.length - 1];
      if (buf && buf.constructor === Uint8Array) {
        const view = new Uint8Array(buf);
        for (let i = 0; i < view.length; i++) {
          if (Math.random() < 0.001) view[i] ^= 1;
        }
      }
    }
    return result;
  };

  // --- Battery API spoof ---
  if (navigator.getBattery) {
    navigator.getBattery().then(b => {
      Object.defineProperty(b, 'charging', { value: true });
      Object.defineProperty(b, 'chargingTime', { value: Infinity });
      Object.defineProperty(b, 'dischargingTime', { value: Infinity });
      Object.defineProperty(b, 'level', { value: 0.85 + Math.random() * 0.1 });
    });
  }

  // --- Permissions API spoof ---
  if (window.Permissions) {
    const _origQuery = window.Permissions.prototype.query;
    window.Permissions.prototype.query = function(opts) {
      return _origQuery.call(this, opts).then(result => {
        const DENY = ['notifications', 'push', 'midi', 'camera', 'microphone'];
        if (DENY.includes(opts.name)) {
          Object.defineProperty(result, 'state', { value: 'prompt' });
        }
        return result;
      });
    };
  }

  // --- Navigator WebGL spoof ---
  const _getParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(param) {
    if (param === 37445) return 'NVIDIA Corporation';
    if (param === 37446) {
      const renderers = [
        'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)',
      ];
      return renderers[Math.floor(Math.random() * renderers.length)];
    }
    return _origGetParameter.call(this, param);
  };

  // --- AudioContext noise ---
  if (window.AudioContext || window.webkitAudioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const _origGetChannelData = AudioContext.prototype.prototype?.constructor?.prototype?.getChannelData;
    // Hook into analyser via scriptProcessor (deprecated but still works)
  }

  // --- navigator.platform spoof ---
  Object.defineProperty(navigator, 'platform', {
    value: ['Win32', 'MacIntel', 'Linux x86_64'][Math.floor(Math.random() * 3)],
    writable: true,
  });

  // --- Hardware concurrency spoof ---
  const hcValues = [2, 4, 4, 4, 6, 8, 8, 12, 16];
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    value: hcValues[Math.floor(Math.random() * hcValues.length)],
    writable: true,
  });

  // --- Device memory spoof ---
  const dmValues = [2, 4, 4, 8, 8, 16];
  Object.defineProperty(navigator, 'deviceMemory', {
    value: dmValues[Math.floor(Math.random() * dmValues.length)],
    writable: true,
  });

  // --- Remove automation flags ---
  window.chrome = { runtime: {} };
  delete window.webdriver;
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
})();
  `.trim();
}

/**
 * Inject the ThreatMetrix noise script into the page (before navigation).
 * Call this via page.addInitScript() or as launch arg.
 */
export async function injectThreatMetrixNoise(page: Page): Promise<void> {
  await page.addInitScript({ content: buildThreatMetrixNoiseScript() });
}

/**
 * Inject noise script into an already-loaded page via evaluate.
 */
export async function injectThreatMetrixNoisePost(page: Page): Promise<void> {
  await page.evaluate(buildThreatMetrixNoiseScript());
}

// =============================================================================
// Pure/synchronous helpers (no Playwright dependency)
// These are unit-testable without a browser.
// =============================================================================

/**
 * Calculate a human-like random delay in milliseconds.
 * Returns a value within [baseMs, baseMs + jitterMs].
 */
export function calculateHumanDelay(baseMs = 50, jitterMs = 70): number {
  return baseMs + Math.floor(Math.random() * jitterMs);
}

/**
 * Per-character typing delay in milliseconds.
 * Spaces and punctuation are slightly slower.
 * Occasionally includes a "thinking pause" (1 in 15 chars).
 */
export function typingDelaySync(char: string): number {
  let base: number;
  if (/\s/.test(char)) {
    base = 80 + Math.random() * 120; // 80-200ms
  } else if (/[!@#$%^&*()_+\-=\[\]{}|;':",.\/<>?]/.test(char)) {
    base = 100 + Math.random() * 150; // 100-250ms
  } else {
    base = 50 + Math.random() * 130; // 50-180ms
  }
  if (Math.random() < 0.07) {
    base += 300 + Math.random() * 500; // thinking pause
  }
  return Math.round(base);
}

/**
 * Generate a smooth cubic Bezier path between two points.
 * Returns { points, durationMs } for smooth mouse movement.
 *
 * @param from - Start point
 * @param to - End point
 * @param curvatureFactor - How much to curve (default 0.3)
 */
export function generateBezierPath(
  from: Point,
  to: Point,
  curvatureFactor = 0.3,
): BezierCurve {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  const perpX = -dy / dist;
  const perpY = dx / dist;
  const magnitude = dist * curvatureFactor;

  const perturbX = (Math.random() - 0.5) * magnitude * 0.5;
  const perturbY = (Math.random() - 0.5) * magnitude * 0.5;

  const cp1x = from.x + dx * 0.33 + (perpX * magnitude + perturbX);
  const cp1y = from.y + dy * 0.33 + (perpY * magnitude + perturbY);
  const cp2x = from.x + dx * 0.66 - (perpX * magnitude - perturbX);
  const cp2y = from.y + dy * 0.66 - (perpY * magnitude - perturbY);

  const numSamples = Math.max(8, Math.ceil(dist / 20));
  const points: Point[] = [];

  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    points.push({
      x: mt3 * from.x + 3 * mt2 * t * cp1x + 3 * mt * t2 * cp2x + t3 * to.x,
      y: mt3 * from.y + 3 * mt2 * t * cp1y + 3 * mt * t2 * cp2y + t3 * to.y,
    });
  }

  const durationMs = Math.round(300 + dist * 1.2 + Math.random() * 300);
  return { points, durationMs };
}

/**
 * Generate a full human mouse path through multiple waypoints.
 * Each leg is a separate cubic Bezier curve.
 */
export function generateHumanMousePath(
  steps: Array<{ action: "move" | "click" | "type"; to: Point }>,
): BezierCurve[] {
  const curves: BezierCurve[] = [];
  let currentPoint: Point = { x: 0, y: 0 };

  for (const step of steps) {
    const curve = generateBezierPath(currentPoint, step.to);
    curves.push(curve);
    currentPoint = step.to;

    if (step.action === "click" || step.action === "type") {
      curves.push({
        points: [step.to, step.to],
        durationMs: calculateHumanDelay(80, 120),
      });
    }
  }

  return curves;
}

/**
 * Calculate the total expected human interaction time from a series of Bezier curves.
 */
export function calculateTotalHumanTime(curves: BezierCurve[]): number {
  return curves.reduce((sum, c) => sum + c.durationMs, 0);
}

/**
 * Generate a human-like scroll sequence as a series of small steps.
 */
export function humanScrollSequence(
  direction: "down" | "up",
  amountPx = 300,
): ScrollStep[] {
  const sign = direction === "down" ? 1 : -1;
  const steps: ScrollStep[] = [];
  const numSteps = 3 + Math.floor(Math.random() * 6); // 3-8 steps

  for (let i = 0; i < numSteps; i++) {
    const delta = sign * (amountPx / numSteps) + (Math.random() - 0.5) * 40;
    steps.push({
      deltaY: delta,
      sleepMs: 50 + Math.random() * 100,
    });
  }

  return steps;
}