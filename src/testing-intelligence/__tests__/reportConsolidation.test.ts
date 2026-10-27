import { describe, expect, it } from 'vitest';
import { buildJUnitXml, buildSummary, escapeXml, normalizeReport } from '../reportConsolidation.js';

describe('CI report consolidation', () => {
  it('normalizes explicit pass/fail statuses from saved test case reports', () => {
    const tests = normalizeReport('results.json', {
      testCaseId: 'login',
      status: 'FAILED',
      stepResults: [
        { stepNumber: 1, description: 'Open login', status: 'PASSED', durationMs: 120 },
        { stepNumber: 2, description: 'Submit login', status: 'FAILED', error: 'Button not found', evidence: ['evidence/step-2.png'] },
      ],
    });
    expect(tests.map(test => test.status)).toEqual(['passed', 'failed']);
    expect(tests[1]?.evidence).toEqual(['evidence/step-2.png']);
  });

  it('never treats missing or non-final outcomes as passed', () => {
    const tests = normalizeReport('report.json', { request: 'smoke', steps: [{ name: 'setup', status: 'executed' }] });
    expect(tests[0]?.status).toBe('skipped');
    const empty = buildSummary([], 0, []);
    expect(empty.status).toBe('no-data');
  });

  it('produces JUnit XML with escaped names and truthful skipped counts', () => {
    const tests = normalizeReport('workflow-report.json', {
      workflowId: 'login & checkout',
      success: false,
      steps: [
        { id: 'tap <button>', status: 'failed', message: 'Not found' },
        { id: 'assert home', status: 'passed' },
      ],
    });
    const summary = buildSummary(tests, 1, [], '2026-10-27T00:00:00.000Z');
    const xml = buildJUnitXml(summary);
    expect(xml).toContain('tests="2" failures="1" skipped="0"');
    expect(xml).toContain('login &amp; checkout');
    expect(xml).toContain('tap &lt;button&gt;');
    expect(escapeXml('a&b')).toBe('a&amp;b');
  });

  it('keeps an unrecognized report as skipped rather than passing it', () => {
    const tests = normalizeReport('report.json', { title: 'Unknown run', summary: 'No status' });
    expect(tests[0]?.status).toBe('skipped');
    expect(buildSummary(tests, 1, []).status).toBe('incomplete');
  });
});
