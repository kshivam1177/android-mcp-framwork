# AndroidMCP Framework

A Model Context Protocol (MCP) server and CLI that gives coding agents Android development capabilities: build, install, and launch on emulators and physical devices; semantic UI automation; logcat/crash diagnostics; project discovery; change-aware testing intelligence.

74 tools across 11 workflows. Five are enabled by default (`device`, `ui-automation`, `session-management`, `doctor`, `workflow-discovery`); the rest are opt-in - see [workflow docs](docs/md-files/workflow.md).

## Install

```bash
npm install -g androidmcp-framework@latest
androidmcp-framework doctor
```

Or run on demand with no global install: `npx -y androidmcp-framework@latest mcp`.

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

Project testing instructions, saved test cases, and generated reports live inside `.androidmcp-framework/`.

## Local checkout config

Build with `npm ci && npm run build`, then configure the MCP client to launch the built entry point `build/cli/index.js mcp`. Use an absolute path to your own checkout; do not copy machine-specific paths from examples.

## How it's built

- **UI automation:** TypeScript with Node.js built-ins; the official Android CLI is reused for semantic layout/input, with ADB only as a coordinate-tap fallback. Tesseract OCR is an optional external executable for screenshot text analysis. No new runtime dependency is added.
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

The `testing-intelligence` workflow analyzes project changes, resolves layered instructions, validates test plans, and writes redacted Markdown/JSON reports under `.androidmcp-framework/test-reports/`. The `ui-automation` workflow supports reusable screen definitions and JSON action sequences under `.androidmcp-framework/screens/` and `.androidmcp-framework/workflows/`. It does not claim autonomous natural-language test generation; see [Testing Framework](docs/md-files/testing-framework.md) and [Declarative UI workflows](docs/ui-workflows.md).

## License

MIT
