export type UnifiedWorkStatus = 'pending' | 'running' | 'passed' | 'failed' | 'blocked' | 'unavailable' | 'incomplete';
export type UnifiedGateDecision = 'pass' | 'fail' | 'incomplete';
export interface UnifiedWorkResult {
  id: string; kind: 'suite' | 'ui-case'; name: string; status: UnifiedWorkStatus;
  attempts: number; durationMs: number; evidence: string[]; error?: string; exitCode?: number | null;
  command?: string; stdout?: string; stderr?: string; completedSteps?: number;
}
export function isRetryableTransient(error: string): boolean {
  const value = error.toLowerCase();
  if (/assertion|expected .*but|compilation failed|compile.*error|syntax error|ambiguous target|could not locate target|unsupported action|test assertion|test definition/.test(value)) return false;
  return /timed? out|timeout|connection reset|socket hang up|daemon disappeared|daemon.*busy|resource busy|temporary failure|temporarily unavailable|failed to connect|connection refused|transport endpoint|device offline/.test(value);
}
export function selectResumableWork<T extends { status: UnifiedWorkStatus; kind: 'suite' | 'ui-case' }>(items: T[]): T[] {
  return items.filter((item) => item.status === 'pending' || item.status === 'blocked' || item.status === 'unavailable' || (item.status === 'running' && item.kind === 'suite'));
}
export function evaluateUnifiedGate(input: { work: Array<{ status: UnifiedWorkStatus }>; gitHeadSha: string | null; workingTreeClean: boolean | null }): {
  decision: UnifiedGateDecision; reason: string; passed: number; failed: number; incomplete: number; total: number;
} {
  const passed = input.work.filter((item) => item.status === 'passed').length;
  const failed = input.work.filter((item) => item.status === 'failed').length;
  const incomplete = input.work.filter((item) => item.status !== 'passed' && item.status !== 'failed').length;
  if (failed > 0) return { decision: 'fail', reason: 'At least one requested work item failed.', passed, failed, incomplete, total: input.work.length };
  if (input.work.length === 0) return { decision: 'incomplete', reason: 'No work items were selected or executed.', passed, failed, incomplete, total: 0 };
  if (!input.gitHeadSha) return { decision: 'incomplete', reason: 'Git HEAD provenance is unavailable.', passed, failed, incomplete, total: input.work.length };
  if (input.workingTreeClean !== true) return { decision: 'incomplete', reason: 'A clean, verifiable working tree is required for a passing evidence gate.', passed, failed, incomplete, total: input.work.length };
  if (incomplete > 0) return { decision: 'incomplete', reason: 'One or more requested work items are not explicitly passed.', passed, failed, incomplete, total: input.work.length };
  return { decision: 'pass', reason: 'All requested work items passed with clean, commit-bound evidence.', passed, failed, incomplete, total: input.work.length };
}
