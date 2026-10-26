# Installation

## Requirements

- **Node.js 18+** (the MCP server and CLI are a Node/TypeScript package)
- **Android SDK** with `platform-tools` (for `adb`) and at least one `build-tools` version installed
- **JDK 17+** on `PATH` or `JAVA_HOME` set (needed by Gradle)
- A Gradle wrapper in your Android project (recommended) or Gradle itself on `PATH`
- Optional, for the richer UI-automation backend: Python 3.9+ with `pip install uiautomator2 && python -m uiautomator2 init`

None of the above needs to be installed *for* AndroidMCP Framework itself - they're the normal Android dev toolchain. Run `androidmcp-framework doctor` any time to check what's actually on this machine.

## Install

```bash
npm install -g androidmcp-framework@latest
```

Verify:

```bash
androidmcp-framework --help
androidmcp-framework doctor
```

### Run without installing globally

Most MCP clients can start the server on demand instead:

```bash
npx -y androidmcp-framework@latest mcp
```

This is what the config snippets in [mcpClient.md](./mcpClient.md) use by default - nothing to install or update manually.

## Updating

```bash
npm install -g androidmcp-framework@latest
```

If you're using the `npx -y androidmcp-framework@latest` form in your MCP client config, you're always on latest automatically (npx re-resolves the version each time, subject to its own cache).

## Next

- [setup.md](./setup.md) - project config, session defaults, the `setup` command
- [agent-setup.md](./agent-setup.md) - setup for Claude Code, Codex, Gemini CLI, Antigravity, VS Code/Copilot, and Android Studio limitations
- [workflow.md](./workflow.md) - what's enabled out of the box and how to change it


## Optional: Google Android CLI integration

To use the optional `android-cli` workflow, install Google's Android CLI separately using the [official guide](https://developer.android.com/tools/agents/android-cli), then run `android update` and `android init`. Ensure `android` is on `PATH` or configure `paths.androidCliPath`. See [android-cli.md](./android-cli.md).
