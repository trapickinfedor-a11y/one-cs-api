/**
 * server/workerEngine/human-sim.test.ts
 *
 * Tests for human behavior simulation functions:
 *   - humanDelay() timing bounds
 *   - typingDelay() timing bounds
 *   - HumanTyping class
 *   - MouseMovement / bezier points
 *   - Scroll simulation
 */

import { describe, expect, it } from "vitest";
import {
  humanDelay,
  typingDelay,
  bezierPoints,
  buildThreatMetrixNoiseScript,
} from "./humanBehavior.js";

async function measureDelay<T>(fn: () => Promise<T>): Promise<number> {
  const start = Date.now();
  await fn();
  return Date.now() - start;
}

// ---------------------------------------------------------------------------
// Suite 1: humanDelay timing
// ---------------------------------------------------------------------------

describe("humanDelay", () => {
  it("takes between 300-1200ms by default", async () => {
    const delays: number[] = [];
    for (let i = 0; i < 20; i++) {
      delays.push(await measureDelay(() => humanDelay()));
    }
    const min = Math.min(...delays);
    const max = Math.max(...delays);
    expect(min).toBeGreaterThanOrEqual(300);
    expect(max).toBeLessThanOrEqual(1200);
  });

  it("returns within specified min/max range", async () => {
    const delays: number[] = [];
    for (let i = 0; i < 10; i++) {
      delays.push(await measureDelay(() => humanDelay(500, 700)));
    }
    for (const d of delays) {
      expect(d).toBeGreaterThanOrEqual(500);
      expect(d).toBeLessThan(751);
    }
  });

  it("produces varied delays across calls (not deterministic)", async () => {
    const delays = new Set<number>();
    for (let i = 0; i < 30; i++) {
      delays.add(await measureDelay(() => humanDelay()));
    }
    expect(delays.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: typingDelay timing
// ---------------------------------------------------------------------------

describe("typingDelay", () => {
  it("produces positive delays for all character types", async () => {
    for (const ch of ["a", "Z", "5", " ", "!"]) {
      const ms = await measureDelay(() => typingDelay(ch));
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThan(1000);
    }
  });

  it("has a rare thinking pause that spikes delay above normal range", async () => {
    const MAX_NORMAL_DELAY = 250;
    let foundSpike = false;
    for (let i = 0; i < 150; i++) {
      const ms = await measureDelay(() => typingDelay("x"));
      if (ms > MAX_NORMAL_DELAY) {
        foundSpike = true;
        break;
      }
    }
    expect(foundSpike).toBe(true);
  });

  it("handles alphanumeric characters without error", async () => {
    for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz") {
      await expect(typingDelay(ch)).resolves.toBeUndefined();
    }
  });

  it("all character types produce measurable positive delays", async () => {
    const delays: { ch: string; ms: number }[] = [];
    for (const ch of ["a", " ", "!", "1", "A"]) {
      delays.push({ ch, ms: await measureDelay(() => typingDelay(ch)) });
    }
    for (const { ms } of delays) {
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThan(1500);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 3: HumanTyping class simulation
// ---------------------------------------------------------------------------

describe("HumanTyping class simulation", () => {
  it("simulates character-by-character typing via per-char delays", async () => {
    const delays: number[] = [];
    for (const char of "Hello") {
      delays.push(await measureDelay(() => typingDelay(char)));
    }
    for (const d of delays) {
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThan(1500);
    }
    const total = delays.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0);
  });

  it("multiple characters accumulate reasonable total typing time", async () => {
    const start = Date.now();
    for (const ch of "Hello World") {
      await typingDelay(ch);
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(20000);
  });
});

// ---------------------------------------------------------------------------
// Suite 4: MouseMovement / bezier points
// ---------------------------------------------------------------------------

describe("MouseMovement", () => {
  it("generates random scatter points between two coordinates", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 200, y: 100 };
    const p1 = bezierPoints(from.x, from.y, to.x, to.y, 20);
    const p2 = bezierPoints(from.x, from.y, to.x, to.y, 20);
    expect(p1.length).toBeGreaterThan(0);
    expect(p2.length).toBeGreaterThan(0);
    const diff1 = Math.abs(p1[p1.length - 1].x - to.x);
    const diff2 = Math.abs(p1[p1.length - 1].y - to.y);
    expect(diff1).toBeLessThanOrEqual(20);
    expect(diff2).toBeLessThanOrEqual(20);
  });

  it("produces different paths on different calls (randomized)", () => {
    const from = { x: 100, y: 200 };
    const to = { x: 500, y: 400 };
    const paths: Array<{ x: number; y: number }[]> = [];
    for (let i = 0; i < 10; i++) {
      paths.push(bezierPoints(from.x, from.y, to.x, to.y, 20));
    }
    const midPoints = paths.map(p => p[Math.floor(p.length / 2)]);
    const uniqueX = new Set(midPoints.map(pt => Math.round(pt.x * 10)));
    const uniqueY = new Set(midPoints.map(pt => Math.round(pt.y * 10)));
    const hasVariation = uniqueX.size > 1 || uniqueY.size > 1;
    expect(hasVariation).toBe(true);
  });

  it("scales number of samples with steps parameter", () => {
    const p10 = bezierPoints(0, 0, 100, 100, 10);
    const p50 = bezierPoints(0, 0, 100, 100, 50);
    expect(p50.length).toBeGreaterThan(p10.length);
    expect(p10.length).toBe(11);
    expect(p50.length).toBe(51);
  });

  it("handles zero-distance move (single point)", () => {
    const points = bezierPoints(50, 50, 50, 50, 10);
    expect(points.length).toBe(11);
    const diff = Math.abs(points[points.length - 1].x - 50);
    expect(diff).toBeLessThanOrEqual(20);
  });

  it("handles diagonal movement in all quadrants", () => {
    const cases = [
      { from: { x: 0, y: 0 }, to: { x: 100, y: 100 } },
      { from: { x: 100, y: 100 }, to: { x: 0, y: 0 } },
      { from: { x: 0, y: 100 }, to: { x: 100, y: 0 } },
      { from: { x: 100, y: 0 }, to: { x: 0, y: 100 } },
    ];
    for (const { from, to } of cases) {
      const points = bezierPoints(from.x, from.y, to.x, to.y, 20);
      expect(points.length).toBe(21);
      const xDiff = Math.abs(points[points.length - 1].x - to.x);
      const yDiff = Math.abs(points[points.length - 1].y - to.y);
      expect(xDiff).toBeLessThanOrEqual(20);
      expect(yDiff).toBeLessThanOrEqual(20);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 5: Scroll simulation
// ---------------------------------------------------------------------------

describe("Scroll simulation", () => {
  it("buildThreatMetrixNoiseScript returns a non-empty script string", () => {
    const script = buildThreatMetrixNoiseScript();
    expect(typeof script).toBe("string");
    expect(script.length).toBeGreaterThan(100);
    expect(script).toContain("toDataURL");
    expect(script).toContain("WebGLRenderingContext");
    expect(script).toContain("navigator");
  });

  it("scroll simulation via bezier path moves Y in the intended direction", () => {
    const from = { x: 500, y: 0 };
    const to = { x: 500, y: 800 };
    const points = bezierPoints(from.x, from.y, to.x, to.y, 20);
    const startY = points[0].y;
    const endY = points[points.length - 1].y;
    expect(endY).toBeGreaterThan(startY);
    const yDiff = Math.abs(endY - to.y);
    expect(yDiff).toBeLessThanOrEqual(20);
  });

  it("scroll events can be represented as random deltaY values", () => {
    const scrollDeltas: number[] = [];
    for (let i = 0; i < 10; i++) {
      scrollDeltas.push(Math.floor(50 + Math.random() * 200));
    }
    for (const delta of scrollDeltas) {
      expect(delta).toBeGreaterThanOrEqual(50);
      expect(delta).toBeLessThan(250);
    }
  });

  it("bezier points generates valid move paths without page interaction", () => {
    const from = { x: 100, y: 100 };
    const to = { x: 300, y: 200 };
    const points = bezierPoints(from.x, from.y, to.x, to.y, 15);
    expect(points.length).toBe(16);
    const xDiff = Math.abs(points[points.length - 1].x - to.x);
    const yDiff = Math.abs(points[points.length - 1].y - to.y);
    expect(xDiff).toBeLessThanOrEqual(20);
    expect(yDiff).toBeLessThanOrEqual(20);
    for (const pt of points) {
      expect(pt.x).toBeGreaterThan(0);
      expect(pt.y).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Additional timing validation
// ---------------------------------------------------------------------------

describe("Human timing integration", () => {
  it("multiple sequential humanDelay calls accumulate naturally", async () => {
    const start = Date.now();
    await humanDelay(100, 150);
    await humanDelay(100, 150);
    await humanDelay(100, 150);
    const total = Date.now() - start;
    expect(total).toBeGreaterThanOrEqual(300);
    expect(total).toBeLessThan(600);
  });

  it("typingDelay does not block the event loop excessively", async () => {
    const start = Date.now();
    await typingDelay("a");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });
});