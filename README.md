# AndroidMCP Framework

A Model Context Protocol (MCP) server and CLI that gives coding agents Android development capabilities: build, install, and launch on emulators and physical devices; semantic UI automation; logcat/crash diagnostics; project discovery; change-aware testing intelligence.

Testing intelligence is enabled by default alongside `device`, `ui-automation`, `session-management`, `doctor`, and `workflow-discovery`. Tools such as `analyze_test_project`, `audit_screen`, `save_test_case`, and `write_test_report` are available without enabling another workflow. See [workflow docs](docs/md-files/workflow.md).

## Install

```bash
npm install -g androidmcp-framework@latest
androidmcp-framework doctor
# Update to the latest global release and clear npm cache
amf update
# Short alias (also installed by npm)
amf doctor
```

Or run on demand with no global install: `npx -y androidmcp-framework@latest mcp`. The `amf update` command updates a global npm installation; if you use `npx`, rerun it with `@latest` to fetch the latest version. If an update is installed, the command clears only npm's `_npx` execution cache under the configured npm cache directory (normally `~/.npm/_npx` on macOS/Linux); it does not clear the shared package-download cache.

## Connect an MCP client

```json
{
  "mcpServers": {
    "androidmcp-framework": {
      "command": "npx",
      "args": ["-y", "androidmcp-framework@latest", "mcp"]
    }
  }
}
```

See [coding agent setup](docs/md-files/agent-setup.md) for Claude Code, Codex, Gemini CLI, Antigravity, and VS Code/GitHub Copilot instructions. Android Studio's documented MCP client requires HTTP, while this server currently exposes stdio only; see [supported clients](docs/md-files/supportedclients.md).

## Initialize an app project

From the Android or Flutter repository root:

```bash
androidmcp-framework setup
```

This creates `.androidmcp-framework/config.yaml`. If existing data remains under `.android-build-mcp/` or `.androidbuildmcp/`, inspect it and run `androidmcp-framework setup --migrate` to copy files without overwriting existing content. The old directory is not deleted automatically.

All project-specific framework data is kept inside `.androidmcp-framework/`. Screenshots are saved under `.androidmcp-framework/artifacts/screenshots/`, raw accessibility hierarchy snapshots under `.androidmcp-framework/artifacts/snapshots/`, and other evidence under `.androidmcp-framework/artifacts/`. `screenshot` returns the absolute saved image path with the image; `snapshot_ui` saves the full tree and returns a compact summary by default. Test-case definitions and timestamped reports remain under `testcases/` and `test-reports/`. The workspace root is discovered by walking upward to the nearest `.androidmcp-framework/config.yaml` or `.git` marker, with the current directory as fallback. Generated artifacts are local outputs and are ignored by Git by default.

## Local checkout config

Build with `npm ci && npm run build`, then configure the MCP client to launch the built entry point `build/cli/index.js mcp`. Use an absolute path to your own checkout; do not copy machine-specific paths from examples.

## How it's built

- **UI automation:** JavaScript/TypeScript plus Android SDK platform-tools (`adb`) only. The optional Python `uiautomator2` bridge has been removed; no Python runtime or `scripts/` directory is required.
- **Device targeting:** emulators and physical devices are unified through ADB. Explicit target, session default, then single connected target are tried in that order.
- **MCP transport:** stdio for local coding agents. Streamable HTTP is not implemented yet.
- **Tools:** one TypeScript module per tool under `src/tools/<workflow>/`.

## Development

```bash
npm ci
npm run build
npm run typecheck
npm test
```

TypeScript compiles from `src/` to generated `build/`. Do not commit generated `build/` or stale `dist/` output.

## Testing framework

The `testing-intelligence` workflow is enabled by default: it analyzes Native Android and Flutter workspaces, discovers nested Flutter packages, saves custom instructions and test cases, audits screens, and writes timestamped Markdown/JSON reports under `.androidmcp-framework/test-reports/YYYY-MM-DD/HHmmss/`. `test_device` routes Flutter unit/widget tests through `flutter test` (`kind: "unit"`) and can run device integration tests with `flutter test -d <device-id> integration_test` when `integration_test/` exists. See [Testing Framework](docs/md-files/testing-framework.md), [Phases 11–15](docs/testing-framework-phases-11-15.md), [Phases 16–20](docs/testing-framework-phases-16-20.md), and [Phases 24–30](docs/testing-framework-phases-24-30.md). The `analyze_test_quality` tool combines test-matrix inventory, changed-file LCOV coverage, historical flaky-test signals, and optional baseline regression comparison in one read-only report.

## License

MIT
