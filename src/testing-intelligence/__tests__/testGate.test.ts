import { describe, expect, it } from 'vitest';
import { evaluateTestGate } from '../testGate.js';

describe('evaluateTestGate', () => {
  it('passes only non-empty explicitly passing results', () => {
    expect(evaluateTestGate({ status: 'passed', passed: 3, failed: 0, skipped: 0, testCount: 3 }).decision).toBe('pass');
  });
  it('does not treat skipped tests or empty reports as passing', () => {
    expect(evaluateTestGate({ status: 'incomplete', passed: 1, skipped: 1, testCount: 2 }).decision).toBe('incomplete');
    expect(evaluateTestGate({ status: 'no-data' }).decision).toBe('incomplete');
  });
  it('fails a report with explicit failures', () => {
    expect(evaluateTestGate({ status: 'failed', passed: 1, failed: 2, testCount: 3 }).decision).toBe('fail');
  });
});
