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
9. Save an immutable run report under `.androidmcp-framework/test-reports/YYYY-MM-DD/HHmmss/`.

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

## Implemented in this iteration

- `analyze_test_project`: read-only Native Android/Flutter scan and Git change summary.
- `save_test_instructions`: stores Markdown instructions without overwriting unless explicitly authorized.
- `save_test_case`: stores structured test-case JSON with overwrite protection.
- `write_test_report`: writes Markdown and JSON reports, without inferring success from missing results.

## Not implemented yet

- Persistent semantic feature/dependency graph.
- LLM-backed natural-language-to-test-plan generation and impact analysis.
- Test script/journey generation and validation.
- Safe, allowlisted test-command execution and platform adapters.
- Verified end-to-end execution against real Native Android and Flutter repositories.
- Evidence collection and report aggregation across retries.

## Safety and correctness

- Never execute arbitrary model-generated shell commands without policy validation and configurable approval.
- Do not delete or overwrite user tests silently.
- Build success does not prove behavioral correctness; assertions must map to stated requirements.
- Report environment failures separately from product failures.
- Keep secrets and production user data out of reports; redact sensitive output.
- Reports should record commit/ref, dirty working tree, test scope, commands, tool versions and exact outcomes.
