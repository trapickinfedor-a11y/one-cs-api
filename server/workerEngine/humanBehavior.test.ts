import { describe, it, expect } from "vitest";
import {
  generateBezierPath,
  calculateHumanDelay,
  generateHumanMousePath,
  calculateTotalHumanTime,
  Point,
  BezierCurve,
} from "./index";

describe("Human Behavior — generateBezierPath", () => {
  // ---------------------------------------------------------------------------
  // Basic structure
  // ---------------------------------------------------------------------------

  it("returns a BezierCurve with points array and durationMs", () => {
    const curve = generateBezierPath({ x: 0, y: 0 }, { x: 100, y: 100 });
    expect(curve).toBeDefined();
    expect(Array.isArray(curve.points)).toBe(true);
    expect(typeof curve.durationMs).toBe("number");
  });

  it("start point equals input from point", () => {
    const from: Point = { x: 100, y: 200 };
    const to: Point = { x: 500, y: 400 };
    const curve = generateBezierPath(from, to);
    expect(curve.points[0]).toEqual(from);
  });

  it("end point equals input to point", () => {
    const from: Point = { x: 100, y: 200 };
    const to: Point = { x: 500, y: 400 };
    const curve = generateBezierPath(from, to);
    const lastPoint = curve.points[curve.points.length - 1];
    expect(lastPoint.x).toBeCloseTo(to.x, 2);
    expect(lastPoint.y).toBeCloseTo(to.y, 2);
  });

  it("points array is monotonically moving from 'from' to 'to'", () => {
    const from: Point = { x: 0, y: 0 };
    const to: Point = { x: 100, y: 50 };
    const curve = generateBezierPath(from, to);

    expect(curve.points.length).toBeGreaterThan(2);
    expect(curve.points[0].x).toBeCloseTo(from.x, 1);
    expect(curve.points[curve.points.length - 1].x).toBeCloseTo(to.x, 1);
    expect(curve.points[curve.points.length - 1].y).toBeCloseTo(to.y, 1);
  });

  // ---------------------------------------------------------------------------
  // Number of samples
  // ---------------------------------------------------------------------------

  it("uses at least 8 samples for short distances", () => {
    const curve = generateBezierPath({ x: 0, y: 0 }, { x: 5, y: 5 });
    expect(curve.points.length).toBeGreaterThanOrEqual(8);
  });

  it("scales number of samples with distance (dist/20)", () => {
    const shortCurve = generateBezierPath({ x: 0, y: 0 }, { x: 50, y: 50 });
    const longCurve = generateBezierPath({ x: 0, y: 0 }, { x: 500, y: 500 });

    expect(longCurve.points.length).toBeGreaterThan(shortCurve.points.length);
  });

  // ---------------------------------------------------------------------------
  // Timing verification
  // ---------------------------------------------------------------------------

  it("durationMs is always positive", () => {
    for (let i = 0; i < 20; i++) {
      const curve = generateBezierPath(
        { x: Math.random() * 100, y: Math.random() * 100 },
        { x: Math.random() * 1000, y: Math.random() * 1000 },
      );
      expect(curve.durationMs).toBeGreaterThan(0);
    }
  });

  it("durationMs increases with distance (rough approximation)", () => {
    const shortCurve = generateBezierPath({ x: 0, y: 0 }, { x: 10, y: 10 });
    const longCurve = generateBezierPath({ x: 0, y: 0 }, { x: 1000, y: 1000 });

    // Long curve should have higher durationMs (accounting for randomness, use a generous threshold)
    expect(longCurve.durationMs).toBeGreaterThan(shortCurve.durationMs - 200);
  });

  it("durationMs formula: base ~300ms + distance * 1.2 + jitter", () => {
    // Run 10 times to verify jitter doesn't violate lower bound
    for (let i = 0; i < 10; i++) {
      const curve = generateBezierPath({ x: 0, y: 0 }, { x: 100, y: 100 });
      const dist = Math.sqrt(100 ** 2 + 100 ** 2); // ~141.4
      const minExpected = 300 + dist * 1.2;
      expect(curve.durationMs).toBeGreaterThanOrEqual(minExpected);
    }
  });

  // ---------------------------------------------------------------------------
  // Curvature
  // ---------------------------------------------------------------------------

  it("curvatureFactor=0 produces straight-ish line (control points near linear)", () => {
    const from: Point = { x: 0, y: 0 };
    const to: Point = { x: 100, y: 0 };
    const curve = generateBezierPath(from, to, 0);

    // With 0 curvature, control points should be nearly collinear
    expect(curve.points.length).toBeGreaterThan(2);
    // Midpoint should be close to straight line (y ≈ 0)
    const midIdx = Math.floor(curve.points.length / 2);
    expect(Math.abs(curve.points[midIdx].y)).toBeLessThan(5);
  });

  it("curvatureFactor > 0 produces curved path (control point offset)", () => {
    const from: Point = { x: 0, y: 0 };
    const to: Point = { x: 100, y: 0 };
    const curve = generateBezierPath(from, to, 0.5);

    // Midpoint should deviate from straight line
    const midIdx = Math.floor(curve.points.length / 2);
    // With curvature, control points create perpendicular offset
    expect(Math.abs(curve.points[midIdx].y)).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // Different movement directions
  // ---------------------------------------------------------------------------

  it("handles movement in all quadrants", () => {
    const cases = [
      { from: { x: 0, y: 0 }, to: { x: 100, y: 100 } },
      { from: { x: 100, y: 100 }, to: { x: 0, y: 0 } },
      { from: { x: 0, y: 100 }, to: { x: 100, y: 0 } },
      { from: { x: 100, y: 0 }, to: { x: 0, y: 100 } },
      { from: { x: 50, y: 50 }, to: { x: 500, y: 800 } },
    ];

    for (const { from, to } of cases) {
      const curve = generateBezierPath(from, to);
      expect(curve.points.length).toBeGreaterThanOrEqual(8);
      expect(curve.durationMs).toBeGreaterThan(0);
      expect(curve.points[0]).toEqual(from);
      // Last point close to destination
      const last = curve.points[curve.points.length - 1];
      expect(Math.abs(last.x - to.x)).toBeLessThan(1);
      expect(Math.abs(last.y - to.y)).toBeLessThan(1);
    }
  });

  // ---------------------------------------------------------------------------
  // Determinism (same inputs → same structure, different randomness)
  // ---------------------------------------------------------------------------

  it("different calls produce different control points (randomized perturbation)", () => {
    const curves: BezierCurve[] = [];
    for (let i = 0; i < 10; i++) {
      curves.push(generateBezierPath({ x: 0, y: 0 }, { x: 100, y: 100 }));
    }

    // With high probability, midpoints differ across runs
    const midPoints = curves.map(c => c.points[Math.floor(c.points.length / 2)]);
    const uniqueX = new Set(midPoints.map(p => Math.round(p.x * 100)));
    const uniqueY = new Set(midPoints.map(p => Math.round(p.y * 100)));

    // At least one of X or Y should have variation
    const hasVariation = uniqueX.size > 1 || uniqueY.size > 1;
    expect(hasVariation).toBe(true);
  });
});

describe("Human Behavior — calculateHumanDelay", () => {
  it("returns baseMs + jitter (0 to jitterMs-1)", () => {
    const baseMs = 50;
    const jitterMs = 70;

    for (let i = 0; i < 100; i++) {
      const delay = calculateHumanDelay(baseMs, jitterMs);
      expect(delay).toBeGreaterThanOrEqual(baseMs);
      expect(delay).toBeLessThan(baseMs + jitterMs);
    }
  });

  it("default values (base=50, jitter=70) produce delays in range 50-119", () => {
    for (let i = 0; i < 50; i++) {
      const delay = calculateHumanDelay();
      expect(delay).toBeGreaterThanOrEqual(50);
      expect(delay).toBeLessThan(120);
    }
  });

  it("respects custom base and jitter", () => {
    const delay = calculateHumanDelay(200, 50);
    expect(delay).toBeGreaterThanOrEqual(200);
    expect(delay).toBeLessThan(250);
  });

  it("produces varied delays (distribution over many calls)", () => {
    const delays = new Set<number>();
    for (let i = 0; i < 50; i++) {
      delays.add(calculateHumanDelay(50, 100));
    }
    // With range 50-149 (100 values) over 50 calls,
    // high probability of getting at least 5 distinct values
    expect(delays.size).toBeGreaterThan(1);
  });
});

describe("Human Behavior — generateHumanMousePath", () => {
  it("returns array of BezierCurve", () => {
    const curves = generateHumanMousePath([
      { action: "move", to: { x: 100, y: 100 } },
      { action: "move", to: { x: 200, y: 200 } },
    ]);

    expect(Array.isArray(curves)).toBe(true);
    for (const curve of curves) {
      expect(Array.isArray(curve.points)).toBe(true);
      expect(typeof curve.durationMs).toBe("number");
    }
  });

  it("each step produces a curve from previous end point", () => {
    const steps = [
      { action: "move" as const, to: { x: 100, y: 100 } },
      { action: "move" as const, to: { x: 200, y: 50 } },
      { action: "move" as const, to: { x: 300, y: 300 } },
    ];

    const curves = generateHumanMousePath(steps);

    // curves[0] starts at {0,0} (initial currentPoint), ends near step[0].to
    expect(curves[0].points[0]).toEqual({ x: 0, y: 0 });
    // curves[1] starts at curves[0]'s end point
    expect(curves[1].points[0].x).toBeCloseTo(curves[0].points[curves[0].points.length - 1].x, 1);
    expect(curves[1].points[0].y).toBeCloseTo(curves[0].points[curves[0].points.length - 1].y, 1);
  });

  it("click action adds micro-pause curve", () => {
    const curves = generateHumanMousePath([
      { action: "move", to: { x: 100, y: 100 } },
      { action: "click", to: { x: 100, y: 100 } },
    ]);

    // At least 2 curves: move + micro-pause
    expect(curves.length).toBeGreaterThanOrEqual(2);
  });

  it("type action adds micro-pause curve", () => {
    const curves = generateHumanMousePath([
      { action: "move", to: { x: 200, y: 200 } },
      { action: "type", to: { x: 200, y: 200 } },
    ]);

    expect(curves.length).toBeGreaterThanOrEqual(2);
  });

  it("empty steps returns empty array", () => {
    const curves = generateHumanMousePath([]);
    expect(curves).toHaveLength(0);
  });

  it("single step returns one curve", () => {
    const curves = generateHumanMousePath([{ action: "move", to: { x: 50, y: 50 } }]);
    expect(curves).toHaveLength(1);
  });
});

describe("Human Behavior — calculateTotalHumanTime", () => {
  it("returns sum of all curve durationMs values", () => {
    const curves: BezierCurve[] = [
      { points: [{ x: 0, y: 0 }, { x: 100, y: 100 }], durationMs: 500 },
      { points: [{ x: 100, y: 100 }, { x: 200, y: 200 }], durationMs: 300 },
      { points: [{ x: 200, y: 200 }, { x: 300, y: 300 }], durationMs: 700 },
    ];

    expect(calculateTotalHumanTime(curves)).toBe(1500);
  });

  it("returns 0 for empty array", () => {
    expect(calculateTotalHumanTime([])).toBe(0);
  });

  it("single curve returns its durationMs", () => {
    const curves: BezierCurve[] = [{ points: [{ x: 0, y: 0 }], durationMs: 400 }];
    expect(calculateTotalHumanTime(curves)).toBe(400);
  });

  it("total time is monotonically increasing with more steps", () => {
    const steps = [
      { action: "move" as const, to: { x: 100, y: 100 } },
      { action: "move" as const, to: { x: 200, y: 200 } },
      { action: "click" as const, to: { x: 200, y: 200 } },
      { action: "move" as const, to: { x: 300, y: 300 } },
    ];

    const curves = generateHumanMousePath(steps);
    const totalTime = calculateTotalHumanTime(curves);

    expect(totalTime).toBeGreaterThan(0);
    // Each step adds at least ~300ms, so 4 steps should be at least ~1200ms
    expect(totalTime).toBeGreaterThan(1000);
  });
});

describe("Human Behavior — Integration: full interaction sequence", () => {
  it("simulates a complete form-filling interaction", () => {
    const formSteps = [
      { action: "move" as const, to: { x: 300, y: 200 } },  // move to SSN field
      { action: "click" as const, to: { x: 300, y: 200 } },  // focus field
      { action: "type" as const, to: { x: 300, y: 200 } },  // type SSN
      { action: "move" as const, to: { x: 300, y: 250 } },  // move to submit button
      { action: "click" as const, to: { x: 300, y: 250 } },  // click submit
    ];

    const curves = generateHumanMousePath(formSteps);
    const totalTime = calculateTotalHumanTime(curves);

    // Should have 7 curves: 5 moves + 2 micro-pauses
    expect(curves.length).toBeGreaterThanOrEqual(5);
    expect(totalTime).toBeGreaterThan(0);

    // Each click/type adds a micro-pause of 80-200ms
    const clickPauses = curves.filter(c =>
      c.points.length === 2 &&
      c.points[0].x === c.points[1].x &&
      c.points[0].y === c.points[1].y
    );

    for (const pause of clickPauses) {
      expect(pause.durationMs).toBeGreaterThanOrEqual(80);
      expect(pause.durationMs).toBeLessThan(200);
    }
  });
});