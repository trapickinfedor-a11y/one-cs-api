import { describe, expect, it } from "vitest";
import {
  extractCreditScore,
  extractCreditScoreFromHtml,
  stripHtml,
} from "./scoreExtractor";

describe("scoreExtractor", () => {
  describe("extractCreditScore — synthetic text patterns", () => {
    it('extracts score from "Your credit score: 720"', () => {
      const text = "Thank you for using ONE CS. Your credit score: 720. This score was retrieved from TransUnion.";
      const score = extractCreditScore(text);
      expect(score).toBe(720);
    });

    it('extracts score from "FICO Score: 680"', () => {
      const text = "FICO Score: 680 — based on your latest TransUnion report dated 2024-01-15.";
      const score = extractCreditScore(text);
      expect(score).toBe(680);
    });

    it('extracts score from "credit score is 750"', () => {
      const text = "According to our records, your credit score is 750 and is considered Very Good.";
      const score = extractCreditScore(text);
      expect(score).toBe(750);
    });

    it('extracts score from "Score: 810"', () => {
      const text = "Report generated. Score: 810. Outstanding credit history detected.";
      const score = extractCreditScore(text);
      expect(score).toBe(810);
    });

    it("extracts score at the lower bound (300)", () => {
      const text = "Your credit score: 300";
      const score = extractCreditScore(text);
      expect(score).toBe(300);
    });

    it("extracts score at the upper bound (850)", () => {
      const text = "FICO Score: 850";
      const score = extractCreditScore(text);
      expect(score).toBe(850);
    });

    it("returns null when score is missing from text", () => {
      const text = "We were unable to retrieve your credit report at this time. Please try again later.";
      const score = extractCreditScore(text);
      expect(score).toBeNull();
    });

    it("returns null for completely empty input", () => {
      expect(extractCreditScore("")).toBeNull();
    });

    it("returns null for whitespace-only input", () => {
      expect(extractCreditScore("   \n\t  ")).toBeNull();
    });

    it("returns null when score value is out of range (< 300)", () => {
      // The pattern matches but the value fails the 300-850 range check
      const text = "Your credit score: 250 — below typical range.";
      const score = extractCreditScore(text);
      expect(score).toBeNull();
    });

    it("returns null when score value is out of range (> 850)", () => {
      const text = "FICO Score: 920 — unexpectedly high.";
      const score = extractCreditScore(text);
      expect(score).toBeNull();
    });

    it("prefers the first (most specific) matching pattern", () => {
      // "Score:" pattern would match "FICO Score:" if the first pattern didn't fire first
      const text = "Your credit score: 720. Score: 680.";
      const score = extractCreditScore(text);
      // "Your credit score:" is matched first and returns 720
      expect(score).toBe(720);
    });

    it("handles multiline text with surrounding noise", () => {
      const text = `
        ======================================
        Credit Report Summary
        --------------------------------------
        Consumer Name:    John Doe
        Report Date:      2024-03-01
        Your credit score: 745
        --------------------------------------
        Source: TransUnion
        Status: ACTIVE
        ======================================
      `;
      const score = extractCreditScore(text);
      expect(score).toBe(745);
    });

    it("is case-insensitive", () => {
      expect(extractCreditScore("YOUR CREDIT SCORE: 700")).toBe(700);
      expect(extractCreditScore("FICO SCORE: 650")).toBe(650);
      expect(extractCreditScore("CREDIT SCORE IS 680")).toBe(680);
    });
  });

  describe("stripHtml", () => {
    it("removes all HTML tags", () => {
      const html = "<p>Your credit score: <strong>720</strong></p>";
      expect(stripHtml(html)).toBe("Your credit score: 720");
    });

    it("collapses multiple whitespace characters", () => {
      const html = "<div>\n  <span>Score:</span>   <b>680</b>\n</div>";
      expect(stripHtml(html)).toBe("Score: 680");
    });

    it("returns empty string for empty input", () => {
      expect(stripHtml("")).toBe("");
    });
  });

  describe("extractCreditScoreFromHtml", () => {
    it("strips HTML then extracts score from synthetic page", () => {
      const html = `
        <html>
          <body>
            <h1>Credit Report</h1>
            <p>Your credit score: <span class="score">745</span></p>
          </body>
        </html>
      `;
      const score = extractCreditScoreFromHtml(html);
      expect(score).toBe(745);
    });

    it("returns null from HTML when no score is present", () => {
      const html = "<html><body><p>No score data available.</p></body></html>";
      expect(extractCreditScoreFromHtml(html)).toBeNull();
    });
  });
});