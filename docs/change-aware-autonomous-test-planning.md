# Change-aware autonomous test planning

The `plan_change_aware_test_run` MCP tool closes the planning loop between Git changes, saved test cases, project instructions, and recent failures.

## What it does

1. Reads the Git diff and working-tree changes against a supplied base ref.
2. Loads saved test cases and uses only explicit file/module mappings as strong evidence of affected coverage.
3. Reads recent unified-run summaries and prioritizes previously failing cases.
4. Selects relevant project test instructions and identifies changed files that are not mapped to selected cases.
5. Suggests a *test type* for each unmapped file (for example, Flutter widget test, Android unit/instrumentation test, or dependency/build smoke test).

## Safety contract

This is a read-only planning tool. It does not write test cases, alter source files, launch an app, run a build, or execute tests. Suggested test types are not generated test scripts and must not be reported as coverage. The result explicitly marks candidate ideas as `candidate-needs-review` and `not-executed`.

Always inspect the plan and candidate coverage ideas before using `generate_test_candidate` or `run_unified_test_run`. When a file is unmapped, keep broad regression recommended; do not infer that unchanged or unselected areas are safe.

## Example MCP request

```json
{
  "request": "Validate login and checkout after recent changes",
  "projectPath": ".",
  "base": "origin/master",
  "maxTestCases": 12,
  "maxPriorFailures": 30
}
```

The output includes selected saved cases, changed files, affected suite hints, unmapped files, candidate test types, relevant instructions, recent failure context, and a safety section stating that no tests were executed.
