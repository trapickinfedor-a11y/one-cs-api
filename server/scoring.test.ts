import { describe, it, expect } from 'vitest';
import {
  buildOneCsResult,
  deriveProductScore,
  deriveDataQualityScore,
  normalizeAdverseReasons,
} from '../shared/oneCsScoring';

describe('ONE CS Scoring Algorithm', () => {
  const cases: Array<{
    label: string;
    creditScore: number | null;
    completenessScore: number;
    adverseReasons: string[];
  }> = [
    { label: '850 / perfect', creditScore: 850, completenessScore: 1.0, adverseReasons: [] },
    { label: '720 / delinquency+utilization', creditScore: 720, completenessScore: 0.85, adverseReasons: ['delinquency', 'high_utilization'] },
    { label: '650 / no reasons', creditScore: 650, completenessScore: 0.70, adverseReasons: [] },
    { label: '580 / serious+collections', creditScore: 580, completenessScore: 0.40, adverseReasons: ['serious_delinquency', 'collections'] },
    { label: 'null / thin file', creditScore: null, completenessScore: 0.10, adverseReasons: [] },
    { label: '300 / bankruptcy+no_file', creditScore: 300, completenessScore: 0.05, adverseReasons: ['bankruptcy', 'no_file'] },
    { label: '780 / thin_file', creditScore: 780, completenessScore: 0.90, adverseReasons: ['thin_file'] },
    { label: '720 / no reasons (bonus)', creditScore: 720, completenessScore: 0.85, adverseReasons: [] },
  ];

  cases.forEach(c => {
    it(c.label, () => {
      const r = buildOneCsResult({
        creditScore: c.creditScore,
        completenessScore: c.completenessScore,
        adverseReasons: c.adverseReasons,
        source: 'testbench',
      });
      console.log(`${c.label} → productScore=${r.productScore} dqs=${r.dataQualityScore} status=${r.status}`);
      expect(r.productScore).toBeGreaterThan(0);
      expect(r.productScore).toBeLessThanOrEqual(20);
      expect(r.dataQualityScore).toBeGreaterThanOrEqual(1);
      expect(r.dataQualityScore).toBeLessThanOrEqual(10);
      expect(['success', 'review', 'decline', 'no_file']).toContain(r.status);
    });
  });

  it('deriveProductScore is linear 300→1 and 850→20', () => {
    expect(deriveProductScore(300)).toBe(1);
    expect(deriveProductScore(850)).toBe(20);
    expect(deriveProductScore(575)).toBeGreaterThan(1);
    expect(deriveProductScore(575)).toBeLessThan(20);
  });

  it('null credit score gives productScore=1', () => {
    expect(deriveProductScore(null)).toBe(1);
  });

  it('normalizeAdverseReasons deduplicates and maps', () => {
    const result = normalizeAdverseReasons([
      'Serious delinquency',
      'Serious delinquency',
      'Proportion of balances to credit limits on bank/national revolving or other revolving accounts is too high',
    ]);
    expect(result.adverseReasonGroups).toContain('delinquency');
    expect(result.adverseReasonGroups).toContain('utilization');
  });

  it('no reasons + score >= 720 gives +0.3 bonus', () => {
    const r720 = buildOneCsResult({ creditScore: 720, completenessScore: 0.85, adverseReasons: [], source: 'testbench' });
    const r719 = buildOneCsResult({ creditScore: 719, completenessScore: 0.85, adverseReasons: [], source: 'testbench' });
    expect(r720.dataQualityScore).toBeGreaterThan(r719.dataQualityScore);
  });
});