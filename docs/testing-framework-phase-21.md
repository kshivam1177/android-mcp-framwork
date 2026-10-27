# Phase 21 — Safe continuous merge and release loop

## Goal

Remove repetitive manual handoffs between green CI, merging, release verification, and the next implementation increment without weakening the quality gate.

## Automated merge policy

The `.github/workflows/auto-merge-green-pr.yml` workflow runs only after the repository's `CI` workflow completes successfully for a pull-request event. It merges only when all of the following remain true:

- The PR is open and not a draft.
- The PR originates from this repository (fork PRs are excluded).
- The target branch is `master`.
- The current PR head SHA exactly matches the SHA tested by the successful CI run.

It uses a squash merge and a SHA precondition. A moved head is skipped rather than merged. Failed, cancelled, or incomplete CI does not trigger a merge. Repository Actions permissions and branch protection/rulesets must allow the workflow token to merge; otherwise the workflow fails closed.

## Release and next increment

The existing npm publish workflow is triggered by qualifying pushes to `master`, verifies package quality before publishing, and records the published package version on `master`. A merge is not itself proof of a successful publish: verify the publish workflow and npm registry version after every merge.

The next product increment should close the Phase 20 gap: a unified, reviewable orchestration of saved UI test cases alongside the project-native Flutter/Gradle suite. Keep execution opt-in, preserve original UI-step evidence and all retry attempts, and make the gate fail for missing or incomplete results. Never describe a unit-suite pass as device E2E coverage.

## Boundaries

This workflow automates merge after green CI; it does not generate new product code or autonomously choose and implement future phases. That requires an explicitly configured coding-agent runner with scoped credentials and a bounded, reviewable task queue. Do not grant a workflow unrestricted ability to author arbitrary code and merge it without tests.
