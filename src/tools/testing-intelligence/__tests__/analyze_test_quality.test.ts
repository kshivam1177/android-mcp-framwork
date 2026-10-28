import { describe, expect, it } from 'vitest';
import { compareTestOutcomes, identifyFlakyTests, parseLcov } from '../analyze_test_quality.js';

describe('parseLcov', () => {
  it('extracts line coverage and uncovered line numbers', () => {
    const parsed = parseLcov([
      'TN:',
      'SF:lib/cart.dart',
      'DA:1,3',
      'DA:2,0',
      'DA:3,0',
      'LF:3',
      'LH:1',
      'end_of_record',
    ].join('\n'));
    expect(parsed).toEqual([{ file: 'lib/cart.dart', found: 3, hit: 1, uncoveredLines: [2, 3] }]);
  });

  it('handles an unfinished final record', () => {
    expect(parseLcov('SF:src/App.kt\nLF:0\nLH:0')).toEqual([
      { file: 'src/App.kt', found: 0, hit: 0, uncoveredLines: [] },
    ]);
  });
});

describe('identifyFlakyTests', () => {
  it('flags only tests with both explicit pass and fail outcomes', () => {
    const flaky = identifyFlakyTests([
      { name: 'login — submit', status: 'passed', report: 'r1' },
      { name: 'login — submit', status: 'failed', report: 'r2' },
      { name: 'stable — opens', status: 'passed', report: 'r3' },
      { name: 'blocked — opens', status: 'skipped', report: 'r4' },
    ]);
    expect(flaky).toEqual([{ name: 'login — submit', passes: 1, failures: 1, reports: ['r1', 'r2'] }]);
  });
});

describe('compareTestOutcomes', () => {
  it('separates regressions, improvements, new tests, and removed tests', () => {
    expect(compareTestOutcomes(
      [{ name: 'login', status: 'passed' }, { name: 'cart', status: 'failed' }, { name: 'old', status: 'passed' }],
      [{ name: 'login', status: 'failed' }, { name: 'cart', status: 'passed' }, { name: 'new', status: 'passed' }],
    )).toEqual({
      regressions: ['login'],
      improvements: ['cart'],
      newTests: ['new'],
      removedTests: ['old'],
    });
  });
});
