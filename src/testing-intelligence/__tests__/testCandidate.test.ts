import { describe, expect, it } from 'vitest';
import { createTestCandidate } from '../testCandidate.js';

describe('createTestCandidate', () => {
  it('creates review-required placeholders only from explicit criteria', () => {
    const candidate = createTestCandidate({ request: 'Verify login flow', platform: 'android', acceptanceCriteria: ['Login screen is visible', 'Error is shown for invalid password'] });
    expect(candidate.reviewRequired).toBe(true);
    expect(candidate.executable).toBe(false);
    expect(candidate.steps).toHaveLength(2);
  });
  it('rejects empty criteria instead of inventing behavior', () => {
    expect(() => createTestCandidate({ request: 'Test login', platform: 'android', acceptanceCriteria: [] })).toThrow('acceptance criterion');
  });
});
