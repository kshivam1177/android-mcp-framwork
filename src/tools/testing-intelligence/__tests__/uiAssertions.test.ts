import { describe, expect, it } from 'vitest';
import { evaluateUiAssertion } from '../../../automation/uiAssertions.js';
import type { UiNode } from '../../../types.js';

const nodes = [
  { text: 'Welcome back', contentDesc: '', resourceId: 'com.example:id/title' },
  { text: '', contentDesc: 'Continue button', resourceId: 'com.example:id/continue' },
] as UiNode[];

describe('evaluateUiAssertion', () => {
  it('defaults to a case-insensitive visible-text assertion', () => {
    expect(evaluateUiAssertion(nodes, 'welcome BACK').passed).toBe(true);
  });

  it('supports explicit visible and contains prefixes', () => {
    expect(evaluateUiAssertion(nodes, 'visible: Welcome back').passed).toBe(true);
    expect(evaluateUiAssertion(nodes, 'contains: com.example:id/title').passed).toBe(true);
  });

  it('supports negative assertions', () => {
    expect(evaluateUiAssertion(nodes, 'not_visible: Login failed').passed).toBe(true);
    expect(evaluateUiAssertion(nodes, 'not_contains: Welcome').passed).toBe(false);
  });

  it('fails empty assertions clearly', () => {
    expect(evaluateUiAssertion(nodes, 'visible: ').message).toContain('must not be empty');
  });

  it('rejects unknown prefixes instead of silently treating them as text', () => {
    expect(evaluateUiAssertion(nodes, 'equals: Welcome').passed).toBe(false);
    expect(evaluateUiAssertion(nodes, 'equals: Welcome').message).toContain('Unsupported assertion prefix');
  });
});
