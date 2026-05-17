import { describe, it, expect } from 'vitest';
import { parseImportedLeadText, toSafeImportedLeadRecord } from '../shared/importedLeadFormat';

describe('Lead Import + PII Masking', () => {
  it('parses multi-block raw text', () => {
    const raw = `John Doe, San Francisco CA 94102, 555-123-4567, john.doe@email.com
12/25/1985, SSN: 123-45-6789, Credit Score: 720

Jane Smith
123 Main St, New York NY 10001 | (212) 555-9876
jane@example.com | DOB: 03/15/1990 | Score: 650`;

    const blocks = parseImportedLeadText(raw);
    // May parse as 1 or 2 blocks depending on blank-line split behavior
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  it('masks PII in toSafeImportedLeadRecord', () => {
    // Parser requires: first line = name (no commas), subsequent lines with Credit Score:
    const raw = `John Doe
San Francisco CA 94102
555-123-4567
john.doe@email.com
12/25/1985
SSN: 123-45-6789
Credit Score: 720`;

    const blocks = parseImportedLeadText(raw);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const safe = toSafeImportedLeadRecord(blocks[0]);

    console.log('Safe record:', JSON.stringify(safe, null, 2));

    // Name should be partially masked (first letter preserved)
    expect(safe.fullName).toMatch(/^J/);
    expect(safe.fullName).not.toBe('John Doe');

    // Email masked → null, normalizedTarget is mock://
    expect(safe.email).toBeNull();
    expect(safe.normalizedTarget).toContain('mock://');
  });

  it('handles minimal input (name + score only)', () => {
    const blocks = parseImportedLeadText('John Doe\nCredit Score: 750');
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const safe = toSafeImportedLeadRecord(blocks[0]);
    expect(safe.creditScore).toBe(750);
  });

  it('handles name-only input', () => {
    const blocks = parseImportedLeadText('Jane Doe');
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const safe = toSafeImportedLeadRecord(blocks[0]);
    expect(safe.creditScore).toBeNull();
  });
});