import { describe, expect, it } from 'vitest';
import { evaluateQualityPolicy } from '../evaluate_test_quality_gate.js';

describe('evaluateQualityPolicy', () => {
  it('passes when configured coverage is met and there are no regressions', () => {
    expect(evaluateQualityPolicy({
      coverageRows: [{ path: 'src/a.ts', percent: 90 }],
      minCoveragePercent: 80,
      regressions: [],
    }).decision).toBe('pass');
  });

  it('fails when a changed file is below the configured threshold', () => {
    const result = evaluateQualityPolicy({
      coverageRows: [{ path: 'src/a.ts', percent: 55 }],
      minCoveragePercent: 80,
    });
    expect(result.decision).toBe('fail');
    expect(result.coverage.belowThreshold).toEqual(['src/a.ts']);
  });

  it('returns incomplete when coverage evidence is missing', () => {
    const result = evaluateQualityPolicy({
      coverageRows: [{ path: 'src/a.ts', percent: null }],
      minCoveragePercent: 80,
    });
    expect(result.decision).toBe('incomplete');
    expect(result.coverage.missingFiles).toEqual(['src/a.ts']);
  });

  it('fails on regressions by default but can explicitly allow them', () => {
    const input = { coverageRows: [], regressions: ['login'], minCoveragePercent: undefined };
    expect(evaluateQualityPolicy(input).decision).toBe('fail');
    expect(evaluateQualityPolicy({ ...input, failOnRegression: false }).decision).toBe('pass');
  });
});
