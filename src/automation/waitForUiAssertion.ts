import type { UiNode } from '../types.js';
import { evaluateUiAssertion, type UiAssertionResult } from './uiAssertions.js';

export type WaitForUiAssertionResult = {
  passed: boolean;
  assertion: UiAssertionResult;
  attempts: number;
  elapsedMs: number;
};

/**
 * Poll a fresh UI hierarchy until an explicit assertion passes or the timeout expires.
 * Actions themselves are deliberately not retried: only the read-only observation is.
 */
export async function waitForUiAssertion(
  readNodes: () => Promise<UiNode[]>,
  expectation: string,
  timeoutMs = 3000,
  pollIntervalMs = 250,
): Promise<WaitForUiAssertionResult> {
  const timeout = Math.max(0, timeoutMs);
  const interval = Math.max(1, pollIntervalMs);
  const started = Date.now();
  let attempts = 0;
  let lastAssertion: UiAssertionResult = {
    passed: false,
    mode: 'contains',
    expected: expectation,
    message: 'UI assertion was not evaluated.',
  };
  let lastReadError: string | undefined;

  do {
    attempts++;
    try {
      lastAssertion = evaluateUiAssertion(await readNodes(), expectation);
      lastReadError = undefined;
      if (lastAssertion.passed) {
        return { passed: true, assertion: lastAssertion, attempts, elapsedMs: Date.now() - started };
      }
      if (lastAssertion.message.includes('must not be empty') || lastAssertion.message.includes('Unsupported assertion prefix')) {
        return { passed: false, assertion: lastAssertion, attempts, elapsedMs: Date.now() - started };
      }
    } catch (error) {
      lastReadError = error instanceof Error ? error.message : String(error);
    }

    const elapsed = Date.now() - started;
    if (elapsed >= timeout) break;
    await new Promise(resolve => setTimeout(resolve, Math.min(interval, timeout - elapsed)));
  } while (Date.now() - started <= timeout);

  const message = lastReadError
    ? 'Timed out after ' + timeout + 'ms waiting for UI assertion "' + expectation + '". Last hierarchy read error: ' + lastReadError
    : 'Timed out after ' + timeout + 'ms waiting for UI assertion "' + expectation + '". ' + lastAssertion.message;
  return {
    passed: false,
    assertion: { ...lastAssertion, passed: false, message },
    attempts,
    elapsedMs: Date.now() - started,
  };
}
