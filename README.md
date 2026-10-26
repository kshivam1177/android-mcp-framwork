# AndroidMCP Framwork

A Model Context Protocol (MCP) server and CLI that gives coding agents Android development capabilities: build, install, and launch on emulators and physical devices; semantic UI automation; logcat/crash diagnostics; JaCoco coverage; project discovery and scaffolding. Modeled on [XcodeBuildMCP](https://github.com/cameroncooke/XcodeBuildMCP)'s tool naming and workflow conventions, translated to the Android/Gradle/adb toolchain.

67 tools across 13 workflows. Five are enabled by default (`device`, `ui-automation`, `session-management`, `doctor`, `workflow-discovery`); the rest are opt-in - see [docs/md-files/workflow.md](docs/md-files/workflow.md).

## Install

```bash
npm install -g androidmcp-framework@latest
androidmcp-framework doctor
```

Or run on demand with no install: `npx -y androidmcp-framework@latest mcp`.

## MCP documentation

- [MCP integration guide](docs/md-files/mcp-guide.md) - protocol behavior, client setup, project context, tool discovery, troubleshooting, and security.
- [Supported clients and transports](docs/md-files/supportedclients.md) - verified integration scope and current limitations.
- [Complete tool reference](docs/md-files/tools.md) - tool descriptions, parameters, and annotations.

## Connect an MCP client

```json
{
  "mcpServers": {
    "androidmcp-framwork": {
      "command": "npx",
      "args": ["-y", "androidmcp-framework@latest", "mcp"]
    }
  }
}
```

See [docs/md-files/agent-setup.md](docs/md-files/agent-setup.md) for copy/paste setup instructions for Claude Code, Codex, Gemini CLI, Antigravity, and VS Code with GitHub Copilot. [Android Studio has a transport limitation](docs/md-files/agent-setup.md#9-android-studio-with-gemini): its documented MCP client does not support stdio, while this server currently uses stdio only.

## Set up a project

```bash
cd your-android-project
androidmcp-framework setup
```

Then either edit `.androidmcp-framework/config.yaml`'s `sessionDefaults`, or call `session_set_defaults` from your agent once connected. Full details: [docs/md-files/setup.md](docs/md-files/setup.md).

## What's here

- [docs/md-files/installation.md](docs/md-files/installation.md) - requirements and install
- [docs/md-files/setup.md](docs/md-files/setup.md) - project config, session defaults, `doctor`
- [docs/md-files/workflow.md](docs/md-files/workflow.md) - the workflow concept, full table, enabling more
- [docs/md-files/tools.md](docs/md-files/tools.md) - every tool, its parameters, and its annotations
- [docs/md-files/agent-setup.md](docs/md-files/agent-setup.md) - complete setup for coding agents and IDEs, example prompts, troubleshooting
- [docs/md-files/mcpClient.md](docs/md-files/mcpClient.md) - generic MCP config and verification
- [docs/md-files/supportedclients.md](docs/md-files/supportedclients.md) - supported clients and limitations

## How it's built

- **UI automation, two tiers**: a zero-setup `adb shell input` + `uiautomator dump` backend by default, and an optional richer tier that shells out to a small bundled Python helper (`scripts/u2_bridge.py`) using the `uiautomator2` library - the same pattern XcodeBuildMCP uses bundling the AXe binary for iOS accessibility automation. Configurable per-project via `automationBackend: adb | uiautomator2 | auto`.
- **Device targeting is unified**, not split into "simulator" vs. "device" workflows the way Xcode is - `adb` itself doesn't distinguish emulators from physical hardware (`adb devices` lists both together), so target resolution is automatic: explicit `targetId` wins, then the active session default, then whichever single target is connected; more than one connected without a pin is a clear error listing the candidates, never a guess.
- **MCP transport**: the current server exposes stdio transport for local coding agents. Android Studio's documented MCP integration currently requires HTTP transport, so direct Android Studio connection needs a future HTTP transport implementation or a separately reviewed bridge.
- One file per tool under `src/tools/<workflow>/<tool_name>.ts`, aggregated per-workflow in each folder's `index.ts`, combined in `src/workflows.ts`.

## Development

```bash
npm install
npm run build       # tsc -> build/
npm run typecheck    # tsc --noEmit
npm test             # vitest - pure-logic unit tests (XML/output parsing, task-name builders, etc.)
npm run dev           # build, then start the MCP server directly
```

## Known limitations (v1)

- No JDWP breakpoint debugging - `debugging` is intentionally logcat/crash/ANR-focused. No existing Android MCP server surveyed for this project attempts real breakpoint debugging, and it would need its own bundled helper.
- `gradle-module` (the roughest analogy to Xcode's `swift-package` workflow) only works for modules applying Gradle's `application` plugin with a runnable `mainClass` - most Android app modules have no such entry point.
- No Streamable HTTP transport yet. Android Studio Gemini cannot connect directly to this stdio-only server; see the agent setup guide.
- `scaffold_android_project` doesn't bundle the Gradle wrapper jar binary - run `gradle wrapper --gradle-version 8.9` once after scaffolding (needs a local Gradle install).
- No macOS-equivalent workflow - dropped rather than forced onto an Android form factor that isn't a real analogue.

## License

MIT


## Natural-language testing framework (Native Android + Flutter)

The `testing-intelligence` workflow is the first foundation for change-aware testing. It currently provides repository analysis, persistent custom test instructions, and timestamped Markdown/JSON reports under `.android-build-mcp/`. It is intentionally not yet advertised as a complete autonomous test generator/executor: those capabilities require platform-specific adapters, test-plan validation, safe command execution, and real-project end-to-end verification.

See [Testing Framework](docs/md-files/testing-framework.md) for the planned lifecycle and current implementation boundaries. See [Coding-agent setup](docs/md-files/agent-setup.md) for install/run instructions, supported agents, example prompts, and troubleshooting.
