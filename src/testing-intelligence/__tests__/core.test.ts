import { describe, expect, it } from 'vitest';
import { analyzeChangedFiles, analyzeTestCaseImpact, parseNameStatusDiff } from '../changeImpact.js';
import { resolveInstructions, validateTestPlan } from '../instructions.js';
import { redactSecrets } from '../report.js';

describe('Git change impact analysis', () => {
  it('parses additions, deletions, modifications and renames', () => {
    expect(parseNameStatusDiff('A\tsrc/new.ts\nM\tlib/main.dart\nD\told.java\nR100\told/name.kt\tnew/name.kt')).toEqual([
      { status: 'added', path: 'src/new.ts' },
      { status: 'modified', path: 'lib/main.dart' },
      { status: 'deleted', path: 'old.java' },
      { status: 'renamed', previousPath: 'old/name.kt', path: 'new/name.kt' },
    ]);
  });

  it('selects targeted suites and broad fallback for unknown impact', () => {
    const targeted = analyzeChangedFiles([{ status: 'modified', path: 'lib/login.dart' }]);
    expect(targeted.selectedSuites).toContain('flutter-test-and-analyze');
    expect(targeted.fallbackToBroadRun).toBe(false);

    const unknown = analyzeChangedFiles([{ status: 'modified', path: 'assets/image.webp' }]);
    expect(unknown.selectedSuites).toContain('broad-regression');
    expect(unknown.fallbackToBroadRun).toBe(true);
  });

  it('falls back conservatively when no change list is available', () => {
    expect(analyzeChangedFiles([]).fallbackToBroadRun).toBe(true);
  });
});

describe('instruction and plan validation', () => {
  it('resolves instructions from general to specific scopes', () => {
    const result = resolveInstructions([
      { scope: 'run', values: { timeout: 10, assertions: ['run'] } },
      { scope: 'global', values: { timeout: 30, retries: 1, device: { serial: 'emulator-5554', locale: 'en' } } },
      { scope: 'project', values: { device: { locale: 'hi' } } },
    ]);
    expect(result.values).toEqual({ timeout: 10, retries: 1, assertions: ['run'], device: { serial: 'emulator-5554', locale: 'hi' } });
    expect(result.appliedScopes).toEqual(['global', 'project', 'run']);
  });

  it('blocks malformed plans instead of guessing', () => {
    expect(validateTestPlan({ goal: 'Login test', steps: [] }).status).toBe('blocked');
    expect(validateTestPlan({ goal: 'Login test', steps: [{ action: 'tap', target: 'Login' }] }).status).toBe('planned');
    expect(validateTestPlan({ goal: 'Login test', steps: [{ target: 'Login' }] }).status).toBe('blocked');
  });
});

describe('secret redaction', () => {
  it('redacts secret-named fields and common bearer/token values', () => {
    expect(redactSecrets({ apiToken: 'abc', message: 'Authorization Bearer abc.def.ghi' })).toEqual({
      apiToken: '[REDACTED]',
      message: 'Authorization Bearer [REDACTED]',
    });
  });
});

describe('saved test case impact mapping', () => {
  it('selects test cases with explicit file mappings and reports unmapped changes', () => {
    const result = analyzeTestCaseImpact(
      [
        { status: 'modified', path: 'lib/login.dart' },
        { status: 'modified', path: 'lib/cart.dart' },
      ],
      [
        { id: 'login-smoke', title: 'Login smoke', category: 'smoke', relatedFiles: ['lib/login.dart'] },
        { id: 'checkout', title: 'Checkout', affectedPaths: ['lib/checkout/**'] },
      ],
    );
    expect(result.selectedTestCases.map(testCase => testCase.id)).toEqual(['login-smoke']);
    expect(result.selectedTestCases[0]?.matchedPaths).toEqual(['lib/login.dart']);
    expect(result.unmappedChangedFiles).toEqual(['lib/cart.dart']);
    expect(result.requiresBroadRegression).toBe(true);
  });

  it('supports directory prefixes and module mappings without treating titles as coverage', () => {
    const result = analyzeTestCaseImpact(
      [{ status: 'modified', path: 'app/src/main/java/com/example/Login.kt' }],
      [
        { id: 'android-login', title: 'Login', modules: ['app/src/main/java/com/example/**'] },
        { id: 'same-name-only', title: 'Login test', description: 'Login behavior' },
      ],
    );
    expect(result.selectedTestCases.map(testCase => testCase.id)).toEqual(['android-login']);
    expect(result.requiresBroadRegression).toBe(false);
  });

  it('requires broad regression when saved test cases lack explicit mappings', () => {
    const result = analyzeTestCaseImpact(
      [{ status: 'modified', path: 'lib/login.dart' }],
      [{ id: 'login', title: 'Login flow', category: 'smoke' }],
    );
    expect(result.selectedTestCases).toEqual([]);
    expect(result.testCaseMappingAvailable).toBe(false);
    expect(result.requiresBroadRegression).toBe(true);
  });
});
