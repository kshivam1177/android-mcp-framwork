# Testing intelligence

AndroidBuildMCP exposes four MCP tools for an initial, conservative test-intelligence workflow and a freshness-aware UI-map cache utility.

## Tools

- `android_test_analyze_changes`: reads Git diff/status in `projectRoot` (defaults to the server's current working directory), or accepts an explicit `changedFiles` list. It proposes test suites by file type and recommends `broad-regression` when mapping is uncertain. It does **not** execute tests.
- `android_test_validate_plan`: validates a structured plan with a non-empty goal and explicit action steps. Invalid or incomplete plans are marked `blocked`; validation is not execution.
- `android_test_resolve_instructions`: merges `global`, `project`, `feature`, and `run` layers in that order. Nested objects merge recursively; arrays and scalar values from a more specific layer replace earlier values.
- `android_test_write_report`: writes Markdown and JSON under `.android-build-mcp/test-reports/<YYYY-MM-DD>/<time>-<run-id>/`. The run ID includes a UUID fragment to avoid collisions.

## UI-map cache utility

`src/automation/uiMapCache.ts` provides a process-local cache for UI-map snapshots with TTL expiry, app-version and source-fingerprint validation, defensive copies, and explicit invalidation. Callers should invalidate entries after navigation, app restart, or state-changing interactions. Stable semantic selectors (resource IDs, test IDs, labels, and roles) should be preferred over coordinates.

The utility is covered by unit tests, but it is not yet wired into the UI snapshot/execution path. Therefore, it does not yet guarantee fewer live inspections or prevent stale-map use by existing automation tools.

## Truthful reporting and secrets

The report writer only reports outcomes supplied by its caller. It never executes tests and does not infer that a test passed from a plan or generated steps. The JSON and Markdown report payload is redacted before writing; fields with names such as `password`, `token`, `secret`, `authorization`, or `credential` are replaced, and common bearer/API-token patterns in strings are masked.

Treat the report as potentially sensitive even after redaction. Avoid sending production data to test runs, and inspect reports before sharing them externally.

## Change-impact limitations

The current mapping is intentionally heuristic and based on paths/extensions, not a complete build dependency graph. Unknown or empty change sets trigger broad regression recommendations. Do not interpret a recommended suite as proof that the suite exists in a particular project; verify available scripts, Gradle tasks, Flutter targets, and test infrastructure before execution.

## Safety and scope

These tools provide a first orchestration layer. They do not currently invoke Google's Android CLI, Flutter commands, or device operations, and they do not autonomously modify application source code. Plans must be reviewed and executed by a separate, verified runner. Safety restrictions around destructive actions and external side effects must be enforced by the execution layer and must never be overridable through project instructions.

## Example requests

- “Analyze my current Git changes and explain which test suites should run.”
- “Validate this test plan: check login with valid credentials, then verify an invalid password shows an error.”
- “Resolve the global, project, feature, and run instructions below.”
- “Write a report containing these actual test outcomes and the available evidence.”
