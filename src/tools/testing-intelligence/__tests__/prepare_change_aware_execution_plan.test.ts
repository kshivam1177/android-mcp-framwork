import { describe, expect, it } from 'vitest';
import { buildExecutionPlan } from '../prepare_change_aware_execution_plan.js';

describe('prepare change-aware execution plan', () => {
  const changes = [{ status: 'modified' as const, path: 'lib/login.dart' }];
  const mappedCase = { id: 'login-smoke', title: 'Login smoke', relatedFiles: ['lib/login.dart'], steps: [{ action: 'tap', target: 'Login' }] };

  it('selects explicitly mapped tests and leaves execution for the unified runner', () => {
    const plan = buildExecutionPlan({ changedFiles: changes, testCases: [mappedCase], platform: 'flutter', suites: ['unit'] });
    expect(plan.status).toBe('prepared-not-executed');
    expect(plan.selectedTestCaseIds).toEqual(['login-smoke']);
    expect(plan.broadRegressionRecommended).toBe(false);
    expect(plan.execution.tool).toBe('run_unified_test_run');
    expect(plan.execution.started).toBe(false);
    expect(plan.coverageClaims.generatedCandidatesCountedAsCoverage).toBe(0);
  });

  it('falls back to broad regression when changes are unmapped', () => {
    const plan = buildExecutionPlan({ changedFiles: changes, testCases: [], platform: 'flutter', suites: ['unit', 'integration'] });
    expect(plan.broadRegressionRecommended).toBe(true);
    expect(plan.selectedTestCaseIds).toEqual([]);
    expect(plan.execution.args).not.toHaveProperty('testCaseIds');
    expect(plan.rationale.join(' ')).toContain('Unmapped changed file');
  });

  it('does not interpret an empty diff as proof that no tests are needed', () => {
    const plan = buildExecutionPlan({ changedFiles: [], testCases: [], platform: 'android-gradle', suites: ['unit'] });
    expect(plan.broadRegressionRecommended).toBe(true);
    expect(plan.coverageClaims.totalChangedFiles).toBe(0);
  });

  it('does not claim generated candidate coverage', () => {
    const plan = buildExecutionPlan({ changedFiles: changes, testCases: [mappedCase], platform: 'flutter', suites: ['unit'] });
    expect(plan.coverageClaims.generatedCandidatesCountedAsCoverage).toBe(0);
    expect(plan.coverageClaims.executionResultsAvailable).toBe(false);
  });
});
