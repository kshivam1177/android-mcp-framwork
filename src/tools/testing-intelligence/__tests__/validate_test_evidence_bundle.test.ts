import { describe, expect, it } from 'vitest';
import { assessEvidenceBundle } from '../validate_test_evidence_bundle.js';

const head = 'a'.repeat(40);
const now = Date.parse('2026-10-28T00:00:00.000Z');

function report(overrides: Partial<{ path: string; generatedAt: string; gitHeadSha: string; tests: Array<{ name: string; status: string }>; maxAgeMinutes: number }> = {}) {
  return {
    path: 'summary.json',
    generatedAt: new Date(now - 5 * 60_000).toISOString(),
    gitHeadSha: head,
    tests: [{ name: 'unit', status: 'passed' }],
    maxAgeMinutes: 60,
    ...overrides,
  };
}

describe('assessEvidenceBundle', () => {
  it('passes when all reports are fresh, match HEAD, and pass on a clean tree', () => {
    expect(assessEvidenceBundle({
      currentHead: head,
      workingTreeClean: true,
      reports: [report()],
      requiredSuites: ['unit'],
      nowMs: now,
    }).decision).toBe('pass');
  });

  it('fails when report provenance differs from current HEAD', () => {
    const result = assessEvidenceBundle({
      currentHead: head,
      workingTreeClean: true,
      reports: [report({ gitHeadSha: 'b'.repeat(40) })],
      nowMs: now,
    });
    expect(result.decision).toBe('fail');
    expect(result.reports[0]?.issues.join(' ')).toContain('does not match current HEAD');
  });

  it('returns incomplete for stale reports and dirty working trees', () => {
    const result = assessEvidenceBundle({
      currentHead: head,
      workingTreeClean: false,
      reports: [report({ maxAgeMinutes: 1 })],
      nowMs: now,
    });
    expect(result.decision).toBe('incomplete');
    expect(result.warnings.join(' ')).toContain('Working tree is dirty');
  });

  it('does not pass reports without recognized test outcomes', () => {
    const result = assessEvidenceBundle({
      currentHead: head,
      workingTreeClean: true,
      reports: [report({ tests: [] })],
      nowMs: now,
    });
    expect(result.decision).toBe('incomplete');
  });

  it('blocks failed and skipped test outcomes and reports missing required suites', () => {
    const result = assessEvidenceBundle({
      currentHead: head,
      workingTreeClean: true,
      reports: [report({ tests: [{ name: 'unit', status: 'failed' }, { name: 'integration', status: 'skipped' }] })],
      requiredSuites: ['unit', 'ui-login'],
      nowMs: now,
    });
    expect(result.decision).toBe('fail');
    expect(result.missingRequiredSuites).toEqual(['ui-login']);
  });
});
