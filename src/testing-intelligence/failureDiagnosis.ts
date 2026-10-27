export type FailureKind = 'environment' | 'assertion' | 'application' | 'likely_flaky' | 'test_definition' | 'unknown';
export interface FailureInput { status?: string; error?: string; message?: string; expectedOutcome?: string; attempt?: number; maxRetries?: number; readOnly?: boolean; }
export interface FailureDiagnosis { kind: FailureKind; confidence: 'high'|'medium'|'low'; rationale: string[]; retryRecommended: boolean; retryAllowed: boolean; maxRetries: number; preserveOriginalFailure: true; }
export function diagnoseFailure(input: FailureInput): FailureDiagnosis {
  const text = [input.status,input.error,input.message,input.expectedOutcome].filter(Boolean).join(' ').toLowerCase();
  const maxRetries = Math.max(0, Math.min(Number.isInteger(input.maxRetries) ? input.maxRetries! : 0, 2));
  const attempt = Math.max(1, Number.isInteger(input.attempt) ? input.attempt! : 1);
  let kind: FailureKind = 'unknown'; let confidence: FailureDiagnosis['confidence'] = 'low'; const rationale: string[] = [];
  if (/no devices|device.*offline|unauthorized|sdk location|android sdk|adb.*not found|gradle.*not found|flutter.*not found|command not found|timed out waiting for device/.test(text)) {
    kind = 'environment'; confidence = 'high'; rationale.push('The output points to a missing or unavailable toolchain/device rather than an assertion result.');
  } else if (/assertion failed|expected .* but (got|was)|ui assertion failed|expected outcome/.test(text)) {
    kind = 'assertion'; confidence = 'high'; rationale.push('An explicit expected-versus-actual or UI assertion failure was reported.');
  } else if (/no such element|ambiguous target|unsupported action|missing.*selector|invalid test case|empty step/.test(text)) {
    kind = 'test_definition'; confidence = 'high'; rationale.push('The saved test definition or selector is invalid or ambiguous.');
  } else if (/connection reset|temporarily unavailable|socket hang up|transient|emulator.*crash|instrumentation process crashed|interrupted|econnreset|503 service unavailable/.test(text)) {
    kind = 'likely_flaky'; confidence = 'medium'; rationale.push('The failure resembles a transient transport, runner, or infrastructure interruption; this is a hypothesis, not proof.');
  } else if (/exception|fatal exception|crash|anr|uncaught|process.*died/.test(text)) {
    kind = 'application'; confidence = 'medium'; rationale.push('The output suggests an application crash or runtime failure; inspect app logs and captured evidence.');
  } else rationale.push('Insufficient signal to classify the failure safely; inspect logs, screenshots, and the original report.');
  const retryRecommended = kind === 'likely_flaky' || kind === 'environment';
  const retryAllowed = retryRecommended && input.readOnly === true && attempt <= maxRetries && maxRetries > 0;
  if (retryRecommended && input.readOnly !== true) rationale.push('Retry is not allowed because the caller did not confirm the test operation is safe to repeat.');
  if (retryRecommended && attempt > maxRetries) rationale.push('The configured retry budget has been exhausted.');
  if (kind === 'assertion' || kind === 'application' || kind === 'test_definition') rationale.push('Do not retry automatically as a way to hide a deterministic failure; preserve and diagnose the original result.');
  return { kind, confidence, rationale, retryRecommended, retryAllowed, maxRetries, preserveOriginalFailure: true };
}
