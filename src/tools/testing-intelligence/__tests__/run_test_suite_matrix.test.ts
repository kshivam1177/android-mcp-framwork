import { describe, expect, it } from 'vitest';
import { summarizeMatrixResults } from '../run_test_suite_matrix.js';

describe('summarizeMatrixResults', () => {
  it('passes only when every requested suite passed', () => {
    expect(summarizeMatrixResults([
      { suite: 'unit', status: 'passed', command: 'flutter test', exitCode: 0, durationMs: 100 },
      { suite: 'integration', status: 'passed', command: 'flutter test integration_test', exitCode: 0, durationMs: 200 },
    ])).toMatchObject({ status: 'passed', testCount: 2, passed: 2, failed: 0, skipped: 0 });
  });

  it('fails when any suite fails', () => {
    expect(summarizeMatrixResults([
      { suite: 'unit', status: 'passed', command: 'flutter test', exitCode: 0, durationMs: 100 },
      { suite: 'integration', status: 'failed', command: 'flutter test integration_test', exitCode: 1, durationMs: 200 },
    ])).toMatchObject({ status: 'failed', passed: 1, failed: 1 });
  });

  it('does not pass if a suite is blocked or unavailable', () => {
    expect(summarizeMatrixResults([
      { suite: 'unit', status: 'passed', command: 'flutter test', exitCode: 0, durationMs: 100 },
      { suite: 'integration', status: 'blocked', command: null, exitCode: null, durationMs: 0 },
    ])).toMatchObject({ status: 'incomplete', passed: 1, skipped: 1, blocked: 1 });
  });

  it('does not pass an empty matrix', () => {
    expect(summarizeMatrixResults([]).status).toBe('incomplete');
  });
});
