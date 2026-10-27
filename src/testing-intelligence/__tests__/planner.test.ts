import { describe, expect, it } from 'vitest';
import { planFromRequest } from '../planner.js';

describe('natural-language test planning', () => {
  it('ranks saved test cases by request terms and reuses stored steps', () => {
    const result = planFromRequest({
      request: 'Please test login flow',
      changedFiles: [],
      testCases: [
        { id: 'checkout', title: 'Checkout payment', steps: [{ stepNumber: 1, description: 'Tap Pay' }] },
        { id: 'login-smoke', title: 'Login flow', category: 'smoke', steps: [{ stepNumber: 1, action: 'Enter username', target: 'username' }], assertions: ['Home screen is visible'] },
      ],
    });
    expect(result.status).toBe('planned');
    expect(result.selectedTestCases[0]?.id).toBe('login-smoke');
    expect(result.steps.map(step => step.action)).toEqual(['Enter username', 'assert']);
    expect(result.executesTests).toBe(false);
  });

  it('uses changed-file mappings as a strong selection signal and flags unmapped files', () => {
    const result = planFromRequest({
      request: 'run regression',
      changedFiles: [
        { status: 'modified', path: 'lib/login.dart' },
        { status: 'modified', path: 'lib/cart.dart' },
      ],
      testCases: [
        { id: 'login', title: 'Login smoke', relatedFiles: ['lib/login.dart'], steps: [{ stepNumber: 1, action: 'Tap Login' }] },
      ],
    });
    expect(result.selectedTestCases.map(testCase => testCase.id)).toContain('login');
    expect(result.unmappedChangedFiles).toEqual(['lib/cart.dart']);
    expect(result.status).toBe('needs_coverage');
  });

  it('does not invent steps when no saved case matches', () => {
    const result = planFromRequest({ request: 'test account recovery', changedFiles: [], testCases: [] });
    expect(result.status).toBe('needs_coverage');
    expect(result.steps).toEqual([]);
    expect(result.missingCoverage.join(' ')).toContain('No saved test case matched');
  });
});
