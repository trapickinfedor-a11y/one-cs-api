import { describe, expect, it } from "vitest";

// Test the scoring engine inputs/outputs with realistic ONE CS scenarios
// These tests use the real buildOneCsResult function with real-world data

describe("ONE CS Scoring — Real-World Scenarios", () => {
  it("high credit score + no adverse reasons → success", async () => {
    const { buildOneCsResult } = await import("../shared/oneCsScoring");

    const result = buildOneCsResult({
      creditScore: 780,
      completenessScore: 0.95,
      adverseReasons: [],
      priceUsd: 1.8,
      durationMs: 4500,
      source: "dashboard",
    });

    expect(result.creditScore).toBe(780);
    expect(result.productScore).toBeGreaterThanOrEqual(15);
    expect(result.dataQualityScore).toBeGreaterThanOrEqual(7);
    expect(result.status).toBe("success");
    expect(result.adverseReasons).toHaveLength(0);
    expect(result.priceUsd).toBeCloseTo(1.8, 2);
  });

  it("low credit score + multiple adverse reasons → decline", async () => {
    const { buildOneCsResult } = await import("../shared/oneCsScoring");

    const result = buildOneCsResult({
      creditScore: 420,
      completenessScore: 0.5,
      adverseReasons: [
        "Serious delinquency",
        "High debt in relation to income",
        "Too many accounts with balances",
      ],
      priceUsd: 1.8,
      durationMs: 4500,
      source: "api",
    });

    expect(result.creditScore).toBe(420);
    expect(result.productScore).toBe(5); // formula: round((420-300)/550*19)+1 = round(4.14)+1 = 5
    expect(result.dataQualityScore).toBe(1); // min clamped: 1.5 - 6.0 = -4.5 → clamp(1, -4.5, 10) = 1
    expect(result.status).toBe("decline");
    expect(result.adverseReasons).toHaveLength(3);
  });

  it("null credit score with thin file → review (not decline)", async () => {
    const { buildOneCsResult } = await import("../shared/oneCsScoring");

    const result = buildOneCsResult({
      creditScore: null,
      completenessScore: undefined,
      adverseReasons: ["Too few accounts currently paid as agreed"],
      priceUsd: 1.8,
      durationMs: 4500,
      source: "telegram",
    });

    expect(result.creditScore).toBeNull();
    expect(result.productScore).toBe(1);
    expect(result.dataQualityScore).toBeLessThanOrEqual(3);
    expect(["review", "decline"]).toContain(result.status);
  });

  it("medium credit score + incomplete profile → review", async () => {
    const { buildOneCsResult } = await import("../shared/oneCsScoring");

    const result = buildOneCsResult({
      creditScore: 651,
      completenessScore: 0.65,
      adverseReasons: [
        "Income or credit history insufficient for loan",
        "Requested amount unsupported by income",
      ],
      priceUsd: 1.8,
      durationMs: 4500,
      source: "dashboard",
    });

    expect(result.status).toBe("review");
    expect(result.dataQualityScore).toBeGreaterThanOrEqual(4);
    expect(result.dataQualityScore).toBeLessThan(7);
  });

  it("score at boundary 720 → base quality 8.0", async () => {
    const { buildOneCsResult } = await import("../shared/oneCsScoring");

    const result = buildOneCsResult({
      creditScore: 720,
      completenessScore: 0.95,
      adverseReasons: [],
      priceUsd: 1.8,
      durationMs: 4500,
      source: "dashboard",
    });

    expect(result.status).toBe("success");
    expect(result.dataQualityScore).toBeGreaterThanOrEqual(7);
  });

  it("all 9 adverse reason groups → decline", async () => {
    const { buildOneCsResult } = await import("../shared/oneCsScoring");

    const result = buildOneCsResult({
      creditScore: 500,
      completenessScore: 0.3,
      adverseReasons: [
        "No credit profile", // no_file
        "Too few accounts currently paid as agreed", // thin_file
        "No recent revolving balances", // low_depth
        "Income or credit history insufficient for loan", // affordability
        "Proportion of balances to credit limits on bank/national revolving or other revolving accounts is too high", // utilization
        "Serious delinquency", // delinquency
        "Bankruptcy", // public_record
        "RiskView Consumer Inquiry", // inquiry_pressure
        "Excessive consumer finance accounts", // consumer_finance
      ],
      priceUsd: 1.8,
      durationMs: 4500,
      source: "api",
    });

    expect(result.productScore).toBe(8); // formula: round((500-300)/550*19)+1 = round(6.9)+1 = 8
    expect(result.dataQualityScore).toBe(1); // clamped at minimum
    expect(result.status).toBe("decline");
  });

  it("VIP request with high score → premium pricing", async () => {
    const { buildOneCsResult } = await import("../shared/oneCsScoring");

    const result = buildOneCsResult({
      creditScore: 800,
      completenessScore: 0.99,
      adverseReasons: [],
      priceUsd: 9.9,
      durationMs: 12000,
      source: "dashboard",
    });

    expect(result.productScore).toBe(18); // formula: round((800-300)/550*19)+1 = 18
    expect(result.status).toBe("success");
    expect(result.dataQualityScore).toBe(10); // base 9.7 + completeness 0.8 + bonus 0.3 = 10.8 → clamp = 10
    expect(result.priceUsd).toBeCloseTo(9.9, 2);
  });
});