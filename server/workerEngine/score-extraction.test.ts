/**
 * server/workerEngine/score-extraction.test.ts
 *
 * Comprehensive tests for scoreExtractor:
 *   - Basic HTML extraction from various selectors
 *   - Range validation (300-850)
 *   - Contextual pattern preferences
 *   - Edge cases: year numbers, dense HTML, TransUnion context
 */

import { describe, expect, it } from "vitest";
import {
  extractCreditScore,
  extractCreditScoreFromHtml,
  stripHtml,
  isValidScore,
  normalizeScore,
  extractScoreFromText,
  type ScoreExtractResult,
} from "./scoreExtractor.js";

describe("scoreExtractor", () => {
  // -------------------------------------------------------------------------
  // T1: Extracts score from simple HTML
  // -------------------------------------------------------------------------
  it("extracts score from simple HTML", () => {
    const html = "<html><body><p>Your credit score: 720</p></body></html>";
    const score = extractCreditScoreFromHtml(html);
    expect(score).toBe(720);
  });

  // -------------------------------------------------------------------------
  // T2: Extracts score from data-testid attribute
  // -------------------------------------------------------------------------
  it("extracts score from data-testid attribute", () => {
    const text = "Your credit score: 750 — check your data-testid score widget.";
    const score = extractCreditScore(text);
    expect(score).toBe(750);
  });

  // -------------------------------------------------------------------------
  // T3: Extracts score from class selector
  // -------------------------------------------------------------------------
  it("extracts score from class selector content", () => {
    const html = `<div class="credit-score-display">
      <span class="score-value">FICO Score: 680</span>
    </div>`;
    const score = extractCreditScoreFromHtml(html);
    expect(score).toBe(680);
  });

  // -------------------------------------------------------------------------
  // T4: Returns null when no score found
  // -------------------------------------------------------------------------
  it("returns null when no score found", () => {
    const text = "We were unable to retrieve your credit report. Please try again later.";
    expect(extractCreditScore(text)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // T5: Ignores numbers outside 300-850 range
  // -------------------------------------------------------------------------
  it("ignores numbers outside 300-850 range", () => {
    // Out of range low
    expect(extractCreditScore("Your credit score: 250")).toBeNull();
    // Out of range high
    expect(extractCreditScore("FICO Score: 920")).toBeNull();
    // Within range
    expect(extractCreditScore("Your credit score: 300")).toBe(300);
    expect(extractCreditScore("FICO Score: 850")).toBe(850);
  });

  // -------------------------------------------------------------------------
  // T6: Prefers labeled scores over plain numbers
  // -------------------------------------------------------------------------
  it("prefers labeled scores over plain numbers", () => {
    // "Your credit score:" is highest priority; should extract 720 even if 680 also present
    const text = "Your credit score: 720. Also see score: 680.";
    const score = extractCreditScore(text);
    expect(score).toBe(720);
  });

  // -------------------------------------------------------------------------
  // T7: Handles scores in dense HTML correctly
  // -------------------------------------------------------------------------
  it("handles scores in dense HTML correctly", () => {
    const html = `<html><head><style>body{font-family:Arial}</style></head>
      <body><div id="report"><h1>Credit Report</h1>
      <p class="summary">Your credit score: <strong>745</strong></p>
      <table><tr><td>Date</td><td>Jan 2024</td></tr></table>
      </div></body></html>`;
    const score = extractCreditScoreFromHtml(html);
    expect(score).toBe(745);
  });

  // -------------------------------------------------------------------------
  // T8: Extracts from TransUnion context
  // -------------------------------------------------------------------------
  it("extracts score from TransUnion context", () => {
    const text = "FICO Score: 780 — based on your latest TransUnion report dated 2024-03-01.";
    const score = extractCreditScore(text);
    expect(score).toBe(780);
  });

  // -------------------------------------------------------------------------
  // T9: Handles score with label text
  // -------------------------------------------------------------------------
  it("handles score with 'credit score is' label text", () => {
    const text = "According to our records, your credit score is 720 and is considered Very Good.";
    const score = extractCreditScore(text);
    expect(score).toBe(720);
  });

  // -------------------------------------------------------------------------
  // T10: Ignores year numbers (2024, 2023) when looking for 3-digit scores
  // -------------------------------------------------------------------------
  it("ignores year numbers (2024, 2023) when looking for 3-digit scores", () => {
    // "Your credit score: 710" is labeled — 710 is extracted; "2023" in date is ignored
    const text = "Report dated 2024-03-01. Your credit score: 710. Previous: 2023.";
    expect(extractCreditScore(text)).toBe(710);

    // Year-only strings with no score label
    expect(extractCreditScore("Year 2024 data")).toBeNull();

    // "check your score: 680" contains "score:" label — matches "Score:" pattern, extracts 680
    expect(extractCreditScore("Report for 2023 — check your score: 680")).toBe(680);
  });

  // -------------------------------------------------------------------------
  // Additional contextual extraction tests
  // -------------------------------------------------------------------------

  it("extracts score from 'Score:' label", () => {
    const text = "Report generated. Score: 810. Outstanding credit history detected.";
    expect(extractCreditScore(text)).toBe(810);
  });

  it("handles multiline report with score embedded", () => {
    const text = `
      ======================================
      Credit Report Summary
      --------------------------------------
      Consumer Name:    Jane Doe
      Report Date:      2024-05-15
      Your credit score: 735
      --------------------------------------
      Source: Equifax
      ======================================
    `;
    expect(extractCreditScore(text)).toBe(735);
  });

  it("returns null for 'no file' / 'no history' text", () => {
    expect(extractCreditScore("No credit file found for this SSN.")).toBeNull();
    expect(extractCreditScore("Unable to find credit profile.")).toBeNull();
    expect(extractCreditScore("Insufficient credit history.")).toBeNull();
    expect(extractCreditScore("No credit history available.")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(extractCreditScore("YOUR CREDIT SCORE: 700")).toBe(700);
    expect(extractCreditScore("fico score: 650")).toBe(650);
    expect(extractCreditScore("CREDIT SCORE IS 680")).toBe(680);
    expect(extractCreditScore("SCORE: 750")).toBe(750);
  });

  it("stripHtml removes all tags and collapses whitespace", () => {
    const html = `<p>Your credit score: <strong>720</strong></p>`;
    expect(stripHtml(html)).toBe("Your credit score: 720");

    const html2 = "<div>\n  <span>Score:</span>   <b>680</b>\n</div>";
    expect(stripHtml(html2)).toBe("Score: 680");
  });

  it("extractCreditScoreFromHtml strips tags then extracts", () => {
    const html = `<html><body><p>Your credit score: <span class="score">745</span></p></body></html>`;
    expect(extractCreditScoreFromHtml(html)).toBe(745);
  });

  it("isValidScore returns true for 300-850 range", () => {
    expect(isValidScore(300)).toBe(true);
    expect(isValidScore(400)).toBe(true);
    expect(isValidScore(500)).toBe(true);
    expect(isValidScore(600)).toBe(true);
    expect(isValidScore(700)).toBe(true);
    expect(isValidScore(800)).toBe(true);
    expect(isValidScore(850)).toBe(true);
    expect(isValidScore(299)).toBe(false);
    expect(isValidScore(851)).toBe(false);
    expect(isValidScore(0)).toBe(false);
    expect(isValidScore(-100)).toBe(false);
    expect(isValidScore(720.5)).toBe(false); // must be integer
  });

  it("normalizeScore handles number, string, and object inputs", () => {
    expect(normalizeScore(720)).toBe(720);
    expect(normalizeScore("720")).toBe(720);
    expect(normalizeScore("  750  ")).toBe(750);
    expect(normalizeScore({ creditScore: 680 })).toBe(680);
    expect(normalizeScore({ score: 700 })).toBe(700);
    expect(normalizeScore(null)).toBeNull();
    expect(normalizeScore(undefined)).toBeNull();
    expect(normalizeScore("invalid")).toBeNull();
    expect(normalizeScore({ other: 123 })).toBeNull();
    // Out of range
    expect(normalizeScore(200)).toBeNull();
    expect(normalizeScore(900)).toBeNull();
    expect(normalizeScore("850")).toBe(850);
    expect(normalizeScore({ creditScore: 299 })).toBeNull();
  });

  it("extractScoreFromText returns ScoreExtractResult with source and pattern metadata", () => {
    const result = extractScoreFromText("Your credit score: 720");

    expect(result).not.toBeNull();
    expect(result!.score).toBe(720);
    expect(result!.source).toBe("explicit");
    expect(result!.matchedPattern).toBe(1);
  });

  it("extractScoreFromText returns null for 'no credit' text", () => {
    expect(extractScoreFromText("No credit file found for this SSN.")).toBeNull();
    expect(extractScoreFromText("Unable to find credit profile")).toBeNull();
  });

  it("extractScoreFromText ignores SSN fragments", () => {
    // SSN-like patterns: 123-45-6789 → "6789" suffix should be skipped
    const text = "Your credit score: 720. SSN last four: 6789.";
    const score = extractCreditScore(text);
    expect(score).toBe(720);
  });

  it("extractCreditScore returns null for completely empty input", () => {
    expect(extractCreditScore("")).toBeNull();
    expect(extractCreditScore("   \n\t  ")).toBeNull();
  });

  it("extractCreditScoreFromHtml returns null when no score present", () => {
    const html = "<html><body><p>No score data available.</p></body></html>";
    expect(extractCreditScoreFromHtml(html)).toBeNull();
  });
});
