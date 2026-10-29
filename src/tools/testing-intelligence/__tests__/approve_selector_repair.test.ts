import { describe, expect, it } from 'vitest';
import { evaluateRepair, resolveUniqueTarget } from '../approve_selector_repair.js';

const now = Date.parse('2026-10-29T12:00:00.000Z');
const base = {
  originalTarget: 'Continue',
  proposedTarget: 'com.example:id/continue',
  hierarchy: [
    { text: 'Continue', resourceId: 'com.example:id/continue', clickable: true, enabled: true },
    { text: 'Cancel', resourceId: 'com.example:id/cancel', clickable: true, enabled: true },
  ],
  evidenceCapturedAt: '2026-10-29T11:59:00.000Z',
  action: 'tap',
  now,
};

describe('runtime-verified selector repair approval', () => {
  it('resolves exact semantic or resource selectors uniquely', () => {
    expect(resolveUniqueTarget('com.example:id/continue', base.hierarchy).matches).toBe(1);
  });

  it('accepts a unique, enabled, clickable target with fresh hierarchy evidence', () => {
    expect(evaluateRepair(base).valid).toBe(true);
  });

  it('rejects stale, future, or invalid hierarchy timestamps', () => {
    expect(evaluateRepair({ ...base, evidenceCapturedAt: '2026-10-29T11:00:00.000Z' }).valid).toBe(false);
    expect(evaluateRepair({ ...base, evidenceCapturedAt: '2026-10-29T12:01:00.000Z' }).valid).toBe(false);
    expect(evaluateRepair({ ...base, evidenceCapturedAt: 'not-a-date' }).valid).toBe(false);
  });

  it('rejects ambiguous and missing proposed targets', () => {
    expect(evaluateRepair({ ...base, proposedTarget: 'Continue', hierarchy: [
      { text: 'Continue', clickable: true, enabled: true },
      { text: 'Continue', clickable: true, enabled: true },
    ] }).valid).toBe(false);
    expect(evaluateRepair({ ...base, proposedTarget: 'missing' }).valid).toBe(false);
  });

  it('requires clickable nodes for tap repairs and rejects unknown enabled state', () => {
    expect(evaluateRepair({ ...base, hierarchy: [{ resourceId: 'com.example:id/continue', clickable: false, enabled: true }] }).valid).toBe(false);
    expect(evaluateRepair({ ...base, hierarchy: [{ resourceId: 'com.example:id/continue', clickable: true }] }).valid).toBe(false);
  });

  it('allows a uniquely resolved non-tap target without requiring clickability', () => {
    expect(evaluateRepair({ ...base, action: 'type_text', hierarchy: [{ resourceId: 'com.example:id/continue', enabled: true }] }).valid).toBe(true);
  });
});
