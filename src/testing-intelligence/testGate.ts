export interface GateInput {
  status?: unknown;
  passed?: unknown;
  failed?: unknown;
  skipped?: unknown;
  testCount?: unknown;
  allowSkipped?: boolean;
}
export interface GateResult {
  decision: 'pass' | 'fail' | 'incomplete';
  reasons: string[];
  counts: { total: number; passed: number; failed: number; skipped: number };
}
function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}
export function evaluateTestGate(input: GateInput): GateResult {
  const passed = count(input.passed);
  const failed = count(input.failed);
  const skipped = count(input.skipped);
  const total = count(input.testCount) || passed + failed + skipped;
  const reasons: string[] = [];
  if (total === 0) reasons.push('No tests were recorded; empty data cannot pass the gate.');
  if (failed > 0) reasons.push(failed + ' test(s) explicitly failed.');
  if (skipped > 0 && !input.allowSkipped) reasons.push(skipped + ' test(s) are skipped or lack an explicit passing outcome.');
  const status = typeof input.status === 'string' ? input.status.toLowerCase() : '';
  if (['failed', 'no-data'].includes(status) && !reasons.some(reason => reason.includes('failed') || reason.includes('No tests'))) reasons.push('Report status is ' + status + '.');
  if (status === 'incomplete' && !input.allowSkipped) reasons.push('Report is incomplete.');
  if (reasons.length) return { decision: total === 0 || (skipped > 0 && !input.allowSkipped) ? 'incomplete' : 'fail', reasons, counts: { total, passed, failed, skipped } };
  return { decision: 'pass', reasons: ['All recorded tests have explicit passing outcomes under the selected policy.'], counts: { total, passed, failed, skipped } };
}
