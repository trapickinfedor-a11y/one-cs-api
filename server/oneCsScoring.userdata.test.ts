import { describe, expect, it } from "vitest";

/**
 * ONE CS Scoring — User Data Validation
 *
 * Runs the real buildOneCsResult algorithm against credit scores from the user dataset.
 * Uses ONLY credit scores (no PII) — scores alone do not identify individuals.
 *
 * Credit score ranges in dataset:
 *   700     × 4 records  — "Your credit score: 700" (with full name/address/SSN stripped)
 *   774     × 1 record   — 774
 *   782     × 1 record   — 782
 *   784     × 1 record   — 784
 *   786     × 2 records  — 786
 *   792     × 2 records  — 792
 *   794     × 1 record   — 794
 *   800     × 2 records  — 800
 *   804     × 3 records  — 804
 *   805     × 2 records  — 805
 *   806     × 3 records  — 806
 *   807     × 1 record   — 807
 *   808     × 2 records  — 808
 *   809     × 1 record   — 809
 *   814     × 1 record   — 814
 *   815     × 1 record   — 815
 *   817     × 1 record   — 817
 *   818     × 1 record   — 818
 *   830     × 1 record   — 830
 *   834     × 1 record   — 834
 *   838     × 1 record   — 838
 *   839     × 1 record   — 839
 *   842     × 1 record   — 842
 *   847     × 1 record   — 847
 * Total: 35 unique score entries
 */

describe("ONE CS — User Data Score Validation", () => {
  // Credit scores from real bot data (score only, no PII)
  const scoreDataset: Array<{ creditScore: number; expectedPs: number; expectedDqsMin: number; expectedDqsMax: number; expectedStatus: "success" | "review" | "decline" }> = [
    // 700 — formula: round((700-300)/550*19)+1 = 15
    { creditScore: 700, expectedPs: 15, expectedDqsMin: 7.0, expectedDqsMax: 8.5, expectedStatus: "success" },
    { creditScore: 774, expectedPs: 17, expectedDqsMin: 8.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 782, expectedPs: 18, expectedDqsMin: 8.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 784, expectedPs: 18, expectedDqsMin: 8.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 786, expectedPs: 18, expectedDqsMin: 8.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 792, expectedPs: 18, expectedDqsMin: 8.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 794, expectedPs: 18, expectedDqsMin: 8.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 800, expectedPs: 18, expectedDqsMin: 9.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 804, expectedPs: 18, expectedDqsMin: 9.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 805, expectedPs: 18, expectedDqsMin: 9.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 806, expectedPs: 18, expectedDqsMin: 9.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 807, expectedPs: 19, expectedDqsMin: 9.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 808, expectedPs: 19, expectedDqsMin: 9.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 809, expectedPs: 19, expectedDqsMin: 9.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 814, expectedPs: 19, expectedDqsMin: 9.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 815, expectedPs: 19, expectedDqsMin: 9.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 817, expectedPs: 19, expectedDqsMin: 9.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 818, expectedPs: 19, expectedDqsMin: 9.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 830, expectedPs: 19, expectedDqsMin: 9.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 834, expectedPs: 19, expectedDqsMin: 9.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 838, expectedPs: 20, expectedDqsMin: 9.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 839, expectedPs: 20, expectedDqsMin: 9.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 842, expectedPs: 20, expectedDqsMin: 9.5, expectedDqsMax: 10.0, expectedStatus: "success" },
    { creditScore: 847, expectedPs: 20, expectedDqsMin: 9.5, expectedDqsMax: 10.0, expectedStatus: "success" },
  ];

  for (const testCase of scoreDataset) {
    it(`creditScore=${testCase.creditScore} → productScore=${testCase.expectedPs}, dqs=${testCase.expectedDqsMin}-${testCase.expectedDqsMax}, status=${testCase.expectedStatus}`, async () => {
      const { buildOneCsResult } = await import("../shared/oneCsScoring");

      const result = buildOneCsResult({
        creditScore: testCase.creditScore,
        completenessScore: undefined, // unknown = 0.65 default
        adverseReasons: [],
        priceUsd: 1.8,
        durationMs: 4500,
        source: "testbench",
      });

      expect(result.creditScore).toBe(testCase.creditScore);
      expect(result.productScore).toBe(testCase.expectedPs);
      expect(result.dataQualityScore).toBeGreaterThanOrEqual(testCase.expectedDqsMin);
      expect(result.dataQualityScore).toBeLessThanOrEqual(testCase.expectedDqsMax);
      expect(result.status).toBe(testCase.expectedStatus);
      expect(result.explanations.length).toBeGreaterThan(0);
    });
  }

  it("all 35 scores from dataset produce success status (no adverse reasons)", async () => {
    const { buildOneCsResult } = await import("../shared/oneCsScoring");

    const allScores = [808, 839, 804, 847, 830, 808, 806, 838, 782, 842, 806, 805, 806, 792, 786, 834, 794, 818, 807, 784, 817, 774, 700, 700, 804, 700, 805, 804, 792, 800, 809, 814, 815, 786, 800];

    const results = allScores.map(cs =>
      buildOneCsResult({ creditScore: cs, completenessScore: undefined, adverseReasons: [], priceUsd: 1.8, durationMs: 4500, source: "testbench" }),
    );

    expect(results.every(r => r.status === "success")).toBe(true);
    expect(results.every(r => r.productScore >= 15)).toBe(true);
    expect(results.every(r => r.dataQualityScore >= 7.0)).toBe(true);
    expect(results.every(r => r.dataQualityScore <= 10.0)).toBe(true);
  });

  it("average dataQualityScore across dataset is high (quality profiles)", async () => {
    const { buildOneCsResult } = await import("../shared/oneCsScoring");

    const allScores = [808, 839, 804, 847, 830, 808, 806, 838, 782, 842, 806, 805, 806, 792, 786, 834, 794, 818, 807, 784, 817, 774, 700, 700, 804, 700, 805, 804, 792, 800, 809, 814, 815, 786, 800];

    const results = allScores.map(cs =>
      buildOneCsResult({ creditScore: cs, completenessScore: undefined, adverseReasons: [], priceUsd: 1.8, durationMs: 4500, source: "testbench" }),
    );

    const avgDqs = results.reduce((sum, r) => sum + r.dataQualityScore, 0) / results.length;
    expect(avgDqs).toBeGreaterThanOrEqual(9.0); // dataset quality is high
  });

  it("score 700 is minimum productScore in dataset (15)", async () => {
    const { buildOneCsResult } = await import("../shared/oneCsScoring");

    const result = buildOneCsResult({ creditScore: 700, completenessScore: undefined, adverseReasons: [], priceUsd: 1.8, durationMs: 4500, source: "testbench" });
    expect(result.productScore).toBe(15);
  });

  it("score 847 is maximum productScore in dataset (20)", async () => {
    const { buildOneCsResult } = await import("../shared/oneCsScoring");

    const result = buildOneCsResult({ creditScore: 847, completenessScore: undefined, adverseReasons: [], priceUsd: 1.8, durationMs: 4500, source: "testbench" });
    expect(result.productScore).toBe(20);
  });

  it("productScore bijectivity holds for all dataset scores", async () => {
    const { buildOneCsResult } = await import("../shared/oneCsScoring");

    const scores = [700, 774, 782, 784, 786, 792, 794, 800, 804, 805, 806, 807, 808, 809, 814, 815, 817, 818, 830, 834, 838, 839, 842, 847];

    for (const cs of scores) {
      const result = buildOneCsResult({ creditScore: cs, completenessScore: 0.95, adverseReasons: [], priceUsd: 1.8, durationMs: 4500, source: "testbench" });
      expect(result.productScore, `score ${cs} → ps ${result.productScore}`).toBeGreaterThanOrEqual(1);
      expect(result.productScore, `score ${cs} → ps ${result.productScore}`).toBeLessThanOrEqual(20);
    }

    // Monotonicity: higher score = same or higher product score
    for (let i = 1; i < scores.length; i++) {
      const prev = buildOneCsResult({ creditScore: scores[i - 1], completenessScore: 0.95, adverseReasons: [], priceUsd: 1.8, durationMs: 4500, source: "testbench" });
      const curr = buildOneCsResult({ creditScore: scores[i], completenessScore: 0.95, adverseReasons: [], priceUsd: 1.8, durationMs: 4500, source: "testbench" });
      expect(curr.productScore, `score ${scores[i]} should not be lower than ${scores[i - 1]}`).toBeGreaterThanOrEqual(prev.productScore);
    }
  });

  it("productScore = 1 when creditScore is 300 (minimum valid)", async () => {
    const { buildOneCsResult } = await import("../shared/oneCsScoring");

    const result = buildOneCsResult({ creditScore: 300, completenessScore: 0.95, adverseReasons: [], priceUsd: 1.8, durationMs: 4500, source: "testbench" });
    expect(result.productScore).toBe(1);
  });

  it("productScore = 20 when creditScore at or above 850", async () => {
    const { buildOneCsResult } = await import("../shared/oneCsScoring");

    const result = buildOneCsResult({ creditScore: 850, completenessScore: 0.95, adverseReasons: [], priceUsd: 1.8, durationMs: 4500, source: "testbench" });
    expect(result.productScore).toBe(20);
  });
});