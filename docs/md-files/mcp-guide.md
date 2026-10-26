# AndroidMCP Framework — MCP integration guide

This guide explains what the server exposes through the Model Context Protocol (MCP), how clients start it, how project/workflow configuration affects tool discovery, and how to troubleshoot a connection.

## 1. What MCP does here

AndroidMCP Framework runs as a local MCP server. An MCP-compatible coding agent can discover and invoke tools to work with Android projects, devices, UI automation, build/test workflows, diagnostics, and project analysis.

The server currently exposes **tools over stdio**. It uses the official TypeScript MCP SDK. This is a local process integration—not a hosted remote service.

### Current capability boundaries

| Capability | Current status |
|---|---|
| MCP tool discovery and invocation | Supported |
| Tool schemas and descriptions | Registered with tools |
| Workflow-based tool availability | Supported |
| Local stdio transport | Supported |
| Streamable HTTP transport | Not implemented in this release |
| Built-in MCP Resources | Not currently advertised |
| Built-in MCP Prompts | Not currently advertised |
| Autonomous generation and execution of every end-to-end test | Not implemented; see the testing framework guide |

MCP is the protocol layer. Android SDK, ADB, Java/JDK, Gradle, optional Flutter tooling, and optional Google Android CLI are separate local dependencies.

## 2. Requirements

- Node.js version allowed by the package (Node 18 or newer; Node 20/22/24 LTS is recommended for current tooling).
- An MCP client that can launch a local stdio server.
- Android SDK command-line tools and a working `adb` installation for device features.
- A JDK and a project Gradle wrapper for Android builds.
- A connected emulator/device for operations that need a target.
- Optional: Flutter SDK for Flutter projects, Google Android CLI for the optional `android-cli` workflow, and Python + `uiautomator2` only when selecting that automation backend.

Check the environment:

```bash
npx -y androidmcp-framework@latest doctor
adb devices -l
```

Run commands from the application repository root when possible so project discovery and per-project configuration resolve to the intended project.

## 3. Generic client configuration

For clients that accept the common `mcpServers` shape:

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

For a local checkout during development, build first and configure the absolute path to `build/cli/index.js`:

```json
{
  "mcpServers": {
    "androidmcp-framework": {
      "command": "node",
      "args": ["/absolute/path/to/android-mcp-framwork/build/cli/index.js", "mcp"]
    }
  }
}
```

Use the configuration schema expected by your specific client. Do not paste the generic JSON into a TOML file or into VS Code's schema without adapting the outer keys.

## 4. Client setup

### Claude Code

From the target project directory:

```bash
claude mcp add androidmcp-framework -- npx -y androidmcp-framework@latest mcp
claude mcp list
```

Alternatively, add the generic JSON entry to the project `.mcp.json`. Restart or reload the session, then verify tool discovery.

### OpenAI Codex

Try the CLI command:

```bash
codex mcp add androidmcp-framework -- npx -y androidmcp-framework@latest mcp
codex mcp list
```

If configuring `~/.codex/config.toml` manually:

```toml
[mcp_servers.androidmcp-framework]
command = "npx"
args = ["-y", "androidmcp-framework@latest", "mcp"]
```

Restart the Codex session after changing the config.

### Gemini CLI

Merge this server into `.gemini/settings.json` in the project, or the user-level Gemini settings file:

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

Preserve existing settings and other server entries.

### Antigravity

Use the MCP server configuration location and schema supported by your installed Antigravity version. For a configuration using `mcpServers`, the server entry is:

```json
{
  "androidmcp-framework": {
    "command": "npx",
    "args": ["-y", "androidmcp-framework@latest", "mcp"]
  }
}
```

Merge it into the existing configuration rather than replacing other servers. Reload the MCP server manager and check connection status.

### VS Code with GitHub Copilot

For the workspace `.vscode/mcp.json` schema:

```json
{
  "servers": {
    "androidmcp-framework": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "androidmcp-framework@latest", "mcp"]
    }
  }
}
```

Open Copilot Chat in Agent mode, open the MCP server management view, and enable/restart the server if prompted. Some VS Code versions also support a root `.mcp.json`; use the schema documented by your installed version.

### Android Studio Gemini

**Direct connection is not supported by the current stdio-only implementation.** If your Android Studio version requires an HTTP MCP endpoint, the command-line stdio configuration above will not work in its MCP settings. A built-in Streamable HTTP transport or a separately reviewed bridge is required. Do not invent an endpoint or assume this server is already listening on a port.

You can still use the server from a supported MCP client while editing the same project in Android Studio.

## 5. Initialize the project

From the Android/Flutter repository root:

```bash
npx -y androidmcp-framework@latest setup
```

Review the generated `.android-build-mcp/config.yaml`. The client config starts the process; this project config controls workflows and defaults. Keep the two concerns separate.

Check the current tool catalog:

```bash
npx -y androidmcp-framework@latest workflows
npx -y androidmcp-framework@latest tools
npx -y androidmcp-framework@latest tools --json
```

Some workflows are enabled by default; others are opt-in. If the agent cannot see a tool, check the workflow list and config, then restart the server. The source workflow catalog and [tools reference](./tools.md) describe current tools and annotations.

## 6. A useful first-run checklist

1. Install/configure Android SDK, JDK, Gradle and ADB.
2. Run `npx -y androidmcp-framework@latest doctor` in a terminal.
3. Confirm `adb devices -l` lists the intended target.
4. Run `androidmcp-framework setup` in the app repository.
5. Configure the MCP client and restart/reload it.
6. Ask the agent to enumerate AndroidMCP Framework tools.
7. Call a read-only tool such as device listing or project discovery before attempting build/install or destructive actions.
8. Enable optional workflows deliberately and restart the server.

## 7. Troubleshooting

### Client says the server failed to start

- Check the client logs for the exact executable, working directory and stderr.
- Run `node --version` and `npx -y androidmcp-framework@latest --help`.
- Run the doctor command separately.
- If behind a proxy/firewall, confirm npm access is available.
- Ensure no shell startup script writes banners or unrelated output to stdout for stdio MCP processes.

### Server connects but tools are missing

- Verify the client is connected to the expected server entry.
- Run `androidmcp-framework workflows` and `androidmcp-framework tools`.
- Inspect `.android-build-mcp/config.yaml` and ensure the intended workflow is enabled.
- Restart/reload the MCP server after changing configuration.

### Tool call fails because a device is unavailable

- Run `adb devices -l`.
- Unlock and authorize the physical device if needed.
- If multiple devices are connected, set an explicit target/session default rather than relying on an ambiguous selection.
- Run the doctor command and inspect the returned diagnostics.

### Wrong project or module is selected

- Start the agent from the application repository root.
- Run `setup` there and inspect session defaults.
- Provide an explicit project path/module/variant when a tool supports those parameters.

### Android Studio cannot connect

The current server is stdio-only. An HTTP endpoint is not available in this release. Use a supported stdio client or wait for a separately implemented and security-reviewed HTTP transport.

## 8. Security and safe use

MCP gives the agent access to tools; it does not make every tool read-only. Some tools build or install apps, change emulator state, clear logs/data, uninstall apps, or write files.

- Connect only to a trusted server package and trusted client.
- Review mutating/destructive tool calls before running them.
- Use disposable emulators and test accounts for destructive or stateful tests.
- Never put API keys, signing passwords, access tokens, or production credentials in prompts, logs, or reports.
- Treat source files, build output, logcat and test reports as potentially sensitive.
- Do not expose a future network transport on a public interface without authentication, origin/host validation, and an explicit security review.
- Reports and generated instructions are evidence records, not proof that tests passed unless the tests were actually executed and their assertions validated.

## 9. Related documentation

- [Installation](./installation.md)
- [Project setup and configuration](./setup.md)
- [Workflow overview](./workflow.md)
- [Complete tool reference](./tools.md)
- [Supported clients and transports](./supportedclients.md)
- [Natural-language testing framework](./testing-framework.md)
- [Agent setup and sample prompts](./agent-setup.md)
