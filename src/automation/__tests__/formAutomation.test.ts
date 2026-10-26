import { describe, expect, it } from 'vitest';
import { matchesUiSelector, resolveUniqueUiNode } from '../formAutomation.js';
import type { UiNode } from '../../types.js';

const node = (overrides: Partial<UiNode> = {}): UiNode => ({
  ref: 'e1', index: 0, className: 'android.widget.EditText', text: 'Email',
  resourceId: 'app:id/email', bounds: { left: 10, top: 20, right: 210, bottom: 70 },
  centerX: 110, centerY: 45, clickable: true, enabled: true, focusable: true,
  scrollable: false, checkable: false, checked: false, depth: 1, ...overrides,
});

describe('form UI selector resolution', () => {
  it('matches resource ID, content description, and case-insensitive text', () => {
    expect(matchesUiSelector(node(), { resourceId: 'app:id/email' })).toBe(true);
    expect(matchesUiSelector(node({ contentDesc: 'Email address' }), { contentDesc: 'Email address' })).toBe(true);
    expect(matchesUiSelector(node(), { textContains: 'ema' })).toBe(true);
    expect(matchesUiSelector(node(), { textContains: 'password' })).toBe(false);
  });

  it('resolves a unique enabled field with valid bounds', () => {
    expect(resolveUniqueUiNode([node()], { resourceId: 'app:id/email' }, 'email', 'field').ref).toBe('e1');
  });

  it('fails closed for missing or ambiguous matches', () => {
    expect(() => resolveUniqueUiNode([], { textContains: 'email' }, 'email', 'field')).toThrow(/Could not find/i);
    expect(() => resolveUniqueUiNode([node(), node({ ref: 'e2' })], { textContains: 'email' }, 'email', 'field')).toThrow(/matched 2 elements/i);
  });

  it('does not treat disabled or zero-sized nodes as targets', () => {
    expect(() => resolveUniqueUiNode([node({ enabled: false })], { resourceId: 'app:id/email' }, 'email', 'field')).toThrow();
    expect(() => resolveUniqueUiNode([node({ bounds: { left: 1, top: 1, right: 1, bottom: 1 } })], { resourceId: 'app:id/email' }, 'email', 'field')).toThrow();
  });
});
