import { describe, expect, it } from 'vitest';
import { createTestCandidate } from '../testCandidate.js';

describe('createTestCandidate', () => {
  it('creates review-required placeholders only from explicit criteria', () => {
    const candidate = createTestCandidate({ request: 'Verify login flow', platform: 'android', acceptanceCriteria: ['Login screen is visible', 'Error is shown for invalid password'] });
    expect(candidate.reviewRequired).toBe(true);
    expect(candidate.executable).toBe(false);
    expect(candidate.steps).toHaveLength(2);
  });
  it('preserves proposed UI actions while requiring review', () => {
    const candidate = createTestCandidate({
      request: 'Verify login flow',
      platform: 'android',
      acceptanceCriteria: ['Dashboard is visible after login'],
      proposedSteps: [
        { action: 'tap', target: 'Login', expectedOutcome: 'Dashboard' },
        { action: 'type_text', target: 'Email', text: 'user@example.com' },
      ],
    });
    expect(candidate.steps[0]?.action).toBe('tap');
    expect(candidate.steps[0]?.reviewRequired).toBe(true);
    expect(candidate.executable).toBe(false);
  });
  it('rejects empty criteria instead of inventing behavior', () => {
    expect(() => createTestCandidate({ request: 'Test login', platform: 'android', acceptanceCriteria: [] })).toThrow('acceptance criterion');
  });
  it('rejects malformed proposed actions', () => {
    expect(() => createTestCandidate({
      request: 'Test login', platform: 'android', acceptanceCriteria: ['Login works'],
      proposedSteps: [{ action: 'type_text', target: 'Email' }],
    })).toThrow('needs text');
  });
});
