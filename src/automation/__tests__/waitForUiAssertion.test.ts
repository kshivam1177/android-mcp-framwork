import { describe, expect, it } from 'vitest';
import { waitForUiAssertion } from '../waitForUiAssertion.js';
import type { UiNode } from '../../types.js';

const node = (text: string) => [{ text, bounds: { left: 0, top: 0, right: 10, bottom: 10 }, centerX: 5, centerY: 5 } as unknown as UiNode];

describe('waitForUiAssertion', () => {
  it('passes when a later hierarchy contains the expected outcome', async () => {
    let reads = 0;
    const result = await waitForUiAssertion(async () => {
      reads++;
      return node(reads < 3 ? 'Loading' : 'Dashboard');
    }, 'visible: Dashboard', 100, 1);

    expect(result.passed).toBe(true);
    expect(result.attempts).toBe(3);
    expect(result.assertion.message).toContain('Dashboard');
  });

  it('returns a clear timeout when the outcome never appears', async () => {
    const result = await waitForUiAssertion(async () => node('Loading'), 'visible: Dashboard', 10, 2);

    expect(result.passed).toBe(false);
    expect(result.assertion.message).toContain('Timed out after 10ms');
    expect(result.assertion.message).toContain('Dashboard');
  });

  it('recovers from transient hierarchy read errors', async () => {
    let reads = 0;
    const result = await waitForUiAssertion(async () => {
      reads++;
      if (reads === 1) throw new Error('temporarily unavailable');
      return node('Dashboard');
    }, 'visible: Dashboard', 100, 1);

    expect(result.passed).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it('reports the last hierarchy error if every read fails', async () => {
    const result = await waitForUiAssertion(async () => {
      throw new Error('hierarchy dump failed');
    }, 'visible: Dashboard', 5, 1);

    expect(result.passed).toBe(false);
    expect(result.assertion.message).toContain('hierarchy dump failed');
  });

  it('fails fast on invalid assertion syntax', async () => {
    const result = await waitForUiAssertion(async () => node('Dashboard'), 'equals: Dashboard', 100, 1);

    expect(result.passed).toBe(false);
    expect(result.elapsedMs).toBeLessThan(50);
    expect(result.assertion.message).toContain('Unsupported assertion prefix');
  });
});
