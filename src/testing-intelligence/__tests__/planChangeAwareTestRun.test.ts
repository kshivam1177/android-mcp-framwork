import { describe, expect, it } from 'vitest';
import { suggestCoverageIdeas } from '../../tools/testing-intelligence/plan_change_aware_test_run.js';

describe('suggestCoverageIdeas', () => {
  it('proposes a focused Flutter test for unmapped Dart source without claiming execution', () => {
    expect(suggestCoverageIdeas(['lib/checkout/cart.dart'])).toEqual([{
      changedPath: 'lib/checkout/cart.dart',
      suggestedTestType: 'flutter-unit-or-widget-test',
      rationale: 'Dart source changed without a saved test mapping; inspect public behavior and add a focused Flutter test.',
      status: 'candidate-needs-review',
      execution: 'not-executed',
    }]);
  });

  it('recognizes Android instrumented tests and dependency manifests', () => {
    const ideas = suggestCoverageIdeas(['app/src/androidTest/java/com/example/LoginTest.kt', 'pubspec.yaml']);
    expect(ideas[0]?.suggestedTestType).toBe('android-instrumentation-test');
    expect(ideas[1]?.suggestedTestType).toBe('build-and-toolchain-smoke');
    expect(ideas.every((idea) => idea.execution === 'not-executed')).toBe(true);
  });

  it('deduplicates and sorts changed paths', () => {
    const ideas = suggestCoverageIdeas(['z/unknown.bin', 'lib/a.dart', 'lib/a.dart']);
    expect(ideas.map((idea) => idea.changedPath)).toEqual(['lib/a.dart', 'z/unknown.bin']);
    expect(ideas[1]?.suggestedTestType).toBe('manual-review-and-broad-regression');
  });
});
