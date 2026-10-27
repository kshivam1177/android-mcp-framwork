import { describe, expect, it } from 'vitest';
import { classifyTestCase } from '../validate_test_environment.js';

describe('classifyTestCase', () => {
  it('accepts saved cases with supported actions and required fields', () => {
    expect(classifyTestCase({
      id: 'TC-LOGIN',
      title: 'Login',
      steps: [
        { action: 'tap', target: 'Sign in' },
        { action: 'type_text', target: 'Email', text: 'qa@example.test' },
        { action: 'key_press', key: '4' },
        { action: 'wait_for_ui' },
      ],
    })).toEqual({ valid: true, stepCount: 4, unsupportedActions: [], issues: [] });
  });

  it('rejects cases with missing steps and unsupported actions', () => {
    const result = classifyTestCase({ id: 'TC-BROKEN', title: 'Broken', steps: [{ action: 'swipe' }] });
    expect(result.valid).toBe(false);
    expect(result.unsupportedActions).toContain('Step 1: swipe');
    expect(result.issues).toContain('Step 1 needs a target or description.');
  });

  it('rejects non-object input', () => {
    expect(classifyTestCase([])).toEqual({
      valid: false,
      stepCount: 0,
      unsupportedActions: [],
      issues: ['Test case JSON must be an object.'],
    });
  });
});
