/**
 * server/workerEngine/scoreExtractor.ts
 *
 * Extracts credit scores from arbitrary HTML/text page content returned by
 * the ONE CS credit score bot. All data is synthetic — this module does not
 * make any network calls.
 */

// Patterns in order of specificity (most specific first)
const SCORE_PATTERNS: Array<{ pattern: RegExp; extract: (m: RegExpMatchArray) => number }> = [
  // "Your credit score: 720"
  {
    pattern: /Your credit score:\s*(\d{3})/i,
    extract: m => parseInt(m[1], 10),
  },
  // "FICO Score: 680"
  {
    pattern: /FICO Score:\s*(\d{3})/i,
    extract: m => parseInt(m[1], 10),
  },
  // "credit score is 750"
  {
    pattern: /credit score is\s+(\d{3})/i,
    extract: m => parseInt(m[1], 10),
  },
  // "Score: 810"
  {
    pattern: /Score:\s*(\d{3})/i,
    extract: m => parseInt(m[1], 10),
  },
  // "Score Result\s\n720"
  {
    pattern: /Score\s+Result[\s\S]{0,20}?(\d{3})/i,
    extract: m => parseInt(m[1], 10),
  },
];

/**
 * Extracts a FICO credit score (300–850) from raw page text.
 *
 * Returns the score as an integer if found, or `null` if no recognizable
 * score pattern was matched.
 *
 * @param text - Raw text content from the ONE CS page (HTML stripped, plain text)
 */
export function extractCreditScore(text: string): number | null {
  if (!text || typeof text !== "string") return null;

  for (const { pattern, extract } of SCORE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const raw = extract(match);
      if (Number.isInteger(raw) && raw >= 300 && raw <= 850) {
        return raw;
      }
    }
  }

  return null;
}

/**
 * Strips HTML tags from a string, leaving only visible text.
 * Used as a preprocessing step before score extraction.
 */
export interface ScoreExtractResult {
  score: number;
  source: "explicit" | "contextual";
  matchedPattern: number;
}

/**
 * Check whether a numeric value falls within the valid FICO range 300-850.
 */
export function isValidScore(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= 300 &&
    value <= 850
  );
}

/**
 * Normalize a value of unknown type to a credit score number or null.
 * Handles numbers, numeric strings, and objects with known score keys.
 */
export function normalizeScore(value: unknown): number | null {
  if (typeof value === "number") return isValidScore(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    const parsed = parseInt(trimmed, 10);
    return isValidScore(parsed) ? parsed : null;
  }
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.creditScore === "number") return isValidScore(obj.creditScore) ? obj.creditScore : null;
    if (typeof obj.score === "number") return isValidScore(obj.score) ? obj.score : null;
  }
  return null;
}

/**
 * Extract score from plain text with rich context patterns.
 * Returns a structured result (score + pattern index) or null.
 *
 * Unlike extractCreditScore(), this function handles contextual patterns
 * and returns metadata about the match.
 *
 * @param text - Raw text content
 */
export function extractScoreFromText(text: string): ScoreExtractResult | null {
  if (!text || typeof text !== "string") return null;

  // Null-score patterns (check first to avoid false positives from scores embedded in text)
  const nullPatterns = [
    /no\s*(credit\s*)?(history|file|profile|record)/i,
    /unable\s*to\s*find\s*(credit\s*)?(profile|record|file)/i,
    /no\s*file/i,
    /no\s*information\s*available/i,
    /insufficient\s*(credit\s*)?(data|history|information)/i,
    /not\s*(enough|sufficient)\s*credit/i,
    /thin\s*file/i,
    /no\s*score/i,
  ];

  for (const p of nullPatterns) {
    if (p.test(text)) return null;
  }

  // Patterns 1-4 use match() (no global needed); pattern 5 uses matchAll() (has /g)
  // Patterns are processed in priority order. High-priority patterns (1-4)
  // return immediately on match; pattern 5 (contextual) iterates all matches
  // and picks the last valid one.
  const patterns: Array<{ re: RegExp; patternIdx: number; useMatchAll: boolean; priority: number }> = [
    { re: /Your credit score:\s*(\d{3})/i, patternIdx: 1, useMatchAll: false, priority: 1 },
    { re: /FICO Score:\s*(\d{3})/i, patternIdx: 2, useMatchAll: false, priority: 2 },
    { re: /credit score is\s+(\d{3})/i, patternIdx: 3, useMatchAll: false, priority: 3 },
    { re: /score\s*:\s*(\d{3})/i, patternIdx: 4, useMatchAll: false, priority: 4 },
    // Standalone 3-digit number in a sentence context (more contextual, lower priority)
    { re: /(?:^|[.\s])(\d{3})(?:\s|$|[.,])/gm, patternIdx: 5, useMatchAll: true, priority: 5 },
  ];

  // For contextual pattern (5), gather all matches and pick the last valid one
  let lastResult: ScoreExtractResult | null = null;

  for (const { re, patternIdx, useMatchAll, priority } of patterns) {
    if (priority < 5) {
      // High-priority patterns: match once, return immediately on valid score
      const m = text.match(re);
      if (m) {
        const rawVal = parseInt(m[1]!, 10);
        if (isValidScore(rawVal)) {
          // Ignore SSN fragments
          const prefix = m.input?.slice(Math.max(0, (m.index ?? 0) - 5), m.index ?? 0) ?? "";
          const suffix = m.input?.slice(((m.index ?? 0) + m[0].length), ((m.index ?? 0) + m[0].length + 3)) ?? "";
          if (/^[\d-]{4,}$/.test(prefix) || /^\d{4,}$/.test(suffix)) {
            // SSN fragment — skip
          } else {
            return {
              score: rawVal,
              source: "explicit",
              matchedPattern: patternIdx,
            };
          }
        }
      }
    } else {
      // Pattern 5 (contextual): iterate all matches, keep the last valid
      // Since pattern 5 has /g flag, use matchAll for correct iteration
      const allMatches = Array.from(text.matchAll(re));

      for (const match of allMatches) {
        const rawVal = parseInt(match[1]!, 10);
        if (isValidScore(rawVal)) {
          const prefix = match.input?.slice(Math.max(0, match.index! - 5), match.index) ?? "";
          const suffix = match.input?.slice(match.index! + match[0].length, match.index! + match[0].length + 3) ?? "";
          if (/^[\d-]{4,}$/.test(prefix) || /^\d{4,}$/.test(suffix)) continue;

          lastResult = {
            score: rawVal,
            source: "contextual",
            matchedPattern: patternIdx,
          };
        }
      }
    }
  }

  return lastResult;
}

/**
 * Strips HTML tags from a string, leaving only visible text.
 * Used as a preprocessing step before score extraction.
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Extracts a credit score from HTML content.
 * Strips tags first, then applies score extraction.
 */
export function extractCreditScoreFromHtml(html: string): number | null {
  return extractCreditScore(stripHtml(html));
}
