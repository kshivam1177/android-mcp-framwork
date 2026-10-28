# Testing framework roadmap: Phase 23 — Git-HEAD-bound test evidence

Phase 23 makes the test gate verify not only that a summary is recent, but also that its source test runs were recorded against the current project Git commit.

## What changed

- `run_test_workflow` and `run_autonomous_test_cycle` record the Git HEAD SHA at execution time in their run summaries.
- `consolidate_test_reports` reads SHA provenance from source reports and emits a consolidated `gitHeadSha` only when every parsed report has a valid SHA and all reports agree on the same commit.
- Consolidated summaries report how many source reports include or lack commit provenance. Missing provenance or mixed source SHAs produces a warning and prevents the summary from claiming a single tested commit.
- `evaluate_test_gate` defaults to `requireCurrentHead: true`. It compares the report's source-derived SHA with the current project HEAD and blocks missing, incomplete, or mismatched provenance.
- The existing freshness check remains in force. Freshness and commit provenance are separate requirements.

## Recommended sequence

1. Run the required project-native and/or saved UI test workflows after the relevant changes.
2. Consolidate reports from those runs.
3. Run `evaluate_test_gate` against that consolidated summary.
4. If the working tree's HEAD changes, rerun the required tests and reconsolidate before relying on the gate.

## Compatibility and limitations

Older reports that do not include `gitHeadSha` remain readable, but they cannot satisfy the default commit-provenance gate. Set `requireCurrentHead: false` only for an explicitly non-CI exploratory use; it weakens the commit-bound guarantee and should not be used for merge authorization.

The gate binds evidence to a Git commit SHA; it does not prove that every relevant test category ran, nor does it establish real-device E2E coverage by itself. The selected test workflows and coverage gaps must still be reviewed.
