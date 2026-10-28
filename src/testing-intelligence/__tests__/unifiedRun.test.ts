import { describe, expect, it } from 'vitest';
import { evaluateUnifiedGate, isRetryableTransient, selectResumableWork, type UnifiedWorkResult } from '../unifiedRun.js';
const item = (id: string, status: UnifiedWorkResult['status'], kind: UnifiedWorkResult['kind'] = 'suite'): UnifiedWorkResult => ({ id, name: id, kind, status, attempts: 1, durationMs: 1, evidence: [] });
describe('unified run policy', () => {
  it('passes only when every requested item passed and provenance is clean', () => {
    expect(evaluateUnifiedGate({ work: [item('unit', 'passed'), item('login', 'passed', 'ui-case')], gitHeadSha: 'a'.repeat(40), workingTreeClean: true }).decision).toBe('pass');
  });
  it('fails when any item failed, even if other items passed', () => {
    expect(evaluateUnifiedGate({ work: [item('unit', 'passed'), item('login', 'failed', 'ui-case')], gitHeadSha: 'a'.repeat(40), workingTreeClean: true }).decision).toBe('fail');
  });
  it('returns incomplete for skipped, empty, dirty, or unproven runs', () => {
    expect(evaluateUnifiedGate({ work: [item('integration', 'blocked')], gitHeadSha: 'a'.repeat(40), workingTreeClean: true }).decision).toBe('incomplete');
    expect(evaluateUnifiedGate({ work: [], gitHeadSha: 'a'.repeat(40), workingTreeClean: true }).decision).toBe('incomplete');
    expect(evaluateUnifiedGate({ work: [item('unit', 'passed')], gitHeadSha: null, workingTreeClean: true }).decision).toBe('incomplete');
    expect(evaluateUnifiedGate({ work: [item('unit', 'passed')], gitHeadSha: 'a'.repeat(40), workingTreeClean: false }).decision).toBe('incomplete');
  });
  it('retries only transient failures, never assertions or compile errors', () => {
    expect(isRetryableTransient('Gradle daemon disappeared')).toBe(true);
    expect(isRetryableTransient('connection reset by peer')).toBe(true);
    expect(isRetryableTransient('UI assertion failed: expected Home')).toBe(false);
    expect(isRetryableTransient('Compilation failed: unresolved reference')).toBe(false);
  });
  it('resumes pending and blocked work, skips passed and failed UI actions', () => {
    const pending = selectResumableWork([item('pass', 'passed'), item('blocked', 'blocked'), item('fail-ui', 'failed', 'ui-case'), item('running-ui', 'running', 'ui-case'), item('running-suite', 'running')]);
    expect(pending.map((x) => x.id)).toEqual(['blocked', 'running-suite']);
  });
});
