# Dev branch synchronization and architecture decisions

## Why this is a selective sync

At the time of the comparison, `master` and `dev` had diverged substantially: GitHub reported 79 commits unique to `dev` and 98 unique to `master`. The `dev` branch also contains an older MCP server implementation using the low-level `Server` request-handler API and a separate `ToolDefinition` registry. The current `master` branch uses `McpServer.registerTool`, Zod schemas, `ToolModule`, workflow-based registration, and shared response helpers.

Merging all of `dev` wholesale would risk replacing the current server architecture and regressing newer tools. This change therefore ports selected capabilities into the current architecture instead of merging the old branch history or overwriting `master`.

## Ported from dev

- **`fill_form`** — selector-based form filling, a fresh hierarchy between fields, fail-closed behavior for missing/ambiguous selectors, and optional submission.
- **Change-impact analysis** — recommends targeted Android, Flutter, tooling, or CI suites from Git changes; unknown mappings trigger a broad-regression fallback.
- **Layered test instructions** — merges global, project, feature, and run scopes with deterministic precedence.
- **Test-plan validation** — incomplete goals or steps are returned as blocked rather than treated as executable plans.
- **Structured test report service** — creates a unique timestamped report directory and redacts common secret fields/token values before writing JSON and Markdown.

These are exposed through the existing MCP workflow and tool-module conventions; the legacy `Server` and `ToolDefinition` registration code is not imported.

## New screenshot OCR capability

The `analyze_screenshot` tool captures the current target's screenshot and sends its bytes over stdin to the local Tesseract OCR process. It returns JSON text lines or words with bounding boxes and center coordinates in screenshot pixels. Tesseract is an optional local executable, configured through `PATH` or `TESSERACT_PATH`; the server does not download OCR models or send screenshots to a hosted service.

OCR coordinates are approximate and primarily identify text. For buttons, switches, and other semantic controls, use `snapshot_ui` and its Android hierarchy bounds first. OCR is a complement, not a replacement for semantic selectors.

## Architectural conventions

- `src/tools/<workflow>/<tool>.ts`: thin MCP adapter, Zod input schema, annotations, and response conversion.
- `src/automation/*.ts` and `src/testing-intelligence/*.ts`: reusable domain/service logic with no MCP registration.
- `src/tools/<workflow>/index.ts`: explicit registration list.
- `src/workflows.ts`: workflow metadata and default-enabled state.
- `src/**/__tests__/*.test.ts`: tests for parsing, selection, and domain behavior independent of a live device.

## Validation still required

The GitHub API editing workflow used for this branch does not run the project's build or tests. Before merging, run:

```bash
npm ci
npm run build
npm run typecheck
npm test
npm run docs:check
npm pack --dry-run
```

Also test `analyze_screenshot` against an emulator with Tesseract installed and verify the returned coordinates against a real screenshot. Test `fill_form` on a disposable app with both unique and ambiguous selectors. A successful tool result only confirms that input actions were issued; it does not prove the form was accepted.
