# Natural-language testing framework: Native Android + Flutter

## Product goal

Provide a change-aware testing lifecycle that reads a repository, maintains human-readable test knowledge, converts natural-language requests into explicit plans, executes existing or generated tests through the appropriate platform tools, and writes auditable reports. The shared intelligence/reporting layer must support both Native Android (Kotlin/Java) and Flutter (Dart). React Native is intentionally out of the first implementation scope, but the architecture should allow a future platform adapter.

## Reuse instead of reinventing

- Use Google Android CLI for the Android capabilities it officially supports, including Android Studio integration and Journeys where available.
- Reuse Gradle, Android unit/instrumentation tests, Flutter test and integration-test commands, and existing project conventions.
- Add adapters only for gaps not covered by existing tools. Do not assume a Google CLI command exists on every OS or CLI version; detect capabilities and report unsupported operations.

## Intended lifecycle

1. Discover platform(s), modules, existing tests, instructions and repository state.
2. Analyze the Git diff and map changed files to affected features and dependencies.
3. Combine the diff, saved testing knowledge and user's natural-language request into a proposed test plan.
4. Reuse existing tests first; propose generated tests/journeys for uncovered behavior.
5. Validate assertions and preconditions before execution. Ask for confirmation before destructive actions or changes to important test assertions.
6. Execute through Google Android CLI, Gradle, Flutter tooling or existing automation adapters.
7. Capture structured outcomes, logs, screenshots and environment details. Distinguish pass, fail, blocked, skipped and inconclusive.
8. Propose knowledge/instruction updates based on verified changes; do not silently replace user-authored instructions.
9. Save an immutable run report and artifacts under `.android-build-mcp/test-reports/YYYY-MM-DD/HHmmss/`.

## On-disk layout

```text
.android-build-mcp/
  knowledge/          # feature map and dependency/test inventory (planned)
  instructions/       # user-authored and reviewed testing instructions
  journeys/           # generated/reviewed natural-language journeys (planned)
  generated-tests/    # generated scripts and assets (planned)
  test-reports/       # immutable timestamped run results
```

## Implemented in this iteration

- `analyze_test_project`: read-only project scan for Native Android/Flutter markers, test files, and Git changed files.
- `save_test_instructions`: saves Markdown instructions under `.android-build-mcp/instructions`; refuses overwrite unless explicitly authorized.
- `write_test_report`: writes `report.md` and `results.json` under the requested timestamped report hierarchy. It does not infer success from missing results.

## Not implemented yet

- Semantic codebase/feature dependency graph and persistent knowledge updates.
- LLM-backed natural-language-to-test-plan generation and impact analysis.
- Test script/journey generation and validation.
- Safe, allowlisted test-command execution and platform adapters.
- Real end-to-end execution on native Android and Flutter demo/sample repositories.
- Evidence artifact collection and report aggregation across retries.

## Safety and correctness requirements

- Never execute arbitrary model-generated shell commands without policy validation and user-configurable approval.
- Do not delete/overwrite user tests silently. Keep generated tests distinguishable from authored tests.
- Do not treat build success as behavioral correctness. Assertions must map to stated requirements.
- Report environment failures separately from product failures. A skipped or inconclusive scenario must never be labeled passed.
- Store secrets and production user data outside reports; redact sensitive output.
- Reports must record commit/ref, dirty working tree, selected test scope, commands, tool versions, and exact outcomes where available.

## Recommended implementation sequence

1. Stabilize and test the current analysis/instruction/report tools.
2. Add structured project manifests and platform detection.
3. Add change-impact planning that links files, features and existing tests.
4. Add platform-specific execution adapters: Google Android CLI + Gradle/Android tests, and Flutter CLI/test runners.
5. Add natural-language plan generation, review gates, generated tests and evidence collection.
6. Validate end-to-end against real Native Android and Flutter repositories before claiming full automation.
