# Natural-language testing framework: Native Android + Flutter

## Product goal

Provide a change-aware testing lifecycle that reads a repository, maintains human-readable test knowledge, converts natural-language requests into explicit plans, executes existing or generated tests through platform tools, and writes auditable reports. The shared intelligence/reporting layer supports Native Android and Flutter.

## Reuse instead of reinventing

- Use Google's Android CLI for supported Android capabilities, including Android Studio integration and Journeys where available.
- Reuse Gradle, Android unit/instrumentation tests, Flutter test and integration-test commands, and established project conventions.
- Add adapters only for gaps not covered by existing tools. Detect capabilities rather than assuming each command exists.

## Intended lifecycle

1. Discover platforms, modules, existing tests, instructions and repository state.
2. Analyze the Git diff and map changed files to affected features and dependencies.
3. Combine the diff, saved testing knowledge and the natural-language request into a proposed test plan.
4. Reuse existing tests first; propose generated tests/journeys for uncovered behavior.
5. Validate assertions and preconditions before execution. Ask for confirmation before destructive actions or changes to important test assertions.
6. Execute through Google Android CLI, Gradle, Flutter tooling or supported automation adapters.
7. Capture structured outcomes, logs, screenshots and environment details. Distinguish pass, fail, blocked, skipped and inconclusive.
8. Propose instruction updates based on verified changes; do not silently replace user-authored instructions.
9. Save immutable run reports under `.androidmcp-framework/test-reports/YYYY-MM-DD/HHmmss/`.

## On-disk layout

```text
.androidmcp-framework/
  config.yaml
  knowledge/          # feature map and dependency/test inventory (planned)
  instructions/       # user-authored and reviewed testing instructions
  journeys/           # generated/reviewed journeys (planned)
  generated-tests/    # generated scripts and assets (planned)
  test-reports/       # immutable timestamped run results
  testcases/          # saved structured test cases
```

## Implemented

- `analyze_test_project`: read-only Native Android/Flutter scan and Git change summary.
- `save_test_instructions`: stores Markdown instructions without overwriting unless explicitly authorized.
- `save_test_case`: stores structured test-case JSON with overwrite protection.
- `write_test_report`: writes Markdown and JSON reports, without inferring success from missing results.

- `analyze_changes`: maps Git changes to targeted test suites and recommends broad regression when impact is uncertain.
- `resolve_test_instructions`: combines global, project, feature, and run-specific instructions with deterministic precedence.
- `validate_test_plan`: blocks incomplete or malformed test plans before execution.
- `audit_screen`: checks visible UI nodes for potential UI issues and relevant log errors.
- `analyze_screenshot`: optional local Tesseract OCR returning text bounds and centers in screenshot-pixel coordinates.
- `fill_form`: fills fields using unique semantic selectors and fails safely for ambiguous or missing targets.
- `run_ui_workflow`: executes a reusable JSON screen/action workflow through the installed official Android CLI, with bounded waits and structured per-run reports.

See [Declarative UI workflows](../ui-workflows.md) and [Screenshot OCR](../screenshot-analysis.md) for JSON formats, prerequisites, and limitations.

## Not implemented yet

- Persistent semantic feature/dependency graph.
- LLM-backed natural-language-to-test-plan generation (change-impact recommendations and deterministic plan validation are implemented, but not LLM-generated plans).
- Test script/journey generation (JSON workflow execution is implemented; natural-language generation remains future work).
- A general allowlisted test-command runner and full Flutter execution adapter; Android UI workflow actions currently delegate to the official Android CLI with a limited ADB coordinate fallback.
- Verified end-to-end execution against real Native Android and Flutter repositories.
- Evidence collection and report aggregation across retries.

## Safety and correctness

- Never execute arbitrary model-generated shell commands without policy validation and configurable approval.
- Do not delete or overwrite user tests silently.
- Build success does not prove behavioral correctness; assertions must map to stated requirements.
- Report environment failures separately from product failures.
- Keep secrets and production user data out of reports; redact sensitive output.
- Reports should record commit/ref, dirty working tree, test scope, commands, tool versions and exact outcomes.
