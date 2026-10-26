# MCP client configuration

AndroidBuildMCP currently runs as a local stdio MCP server. Most supported coding agents can launch it with `npx -y androidbuildmcp@latest mcp`. For complete setup instructions for Claude Code, Codex, Gemini CLI, Antigravity, VS Code/Copilot, and the Android Studio transport limitation, see [agent-setup.md](./agent-setup.md).

## Generic MCP configuration

For clients using the common `mcpServers` schema:

```json
{
  "mcpServers": {
    "androidbuildmcp": {
      "command": "npx",
      "args": ["-y", "androidbuildmcp@latest", "mcp"]
    }
  }
}
```

For VS Code's legacy/workspace `.vscode/mcp.json` schema, use a top-level `servers` object:

```json
{
  "servers": {
    "androidbuildmcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "androidbuildmcp@latest", "mcp"]
    }
  }
}
```

## Verify installation

Run these as normal terminal commands (not inside the MCP client config):

```bash
node --version
npx -y androidbuildmcp@latest --help
androidbuildmcp doctor
androidbuildmcp workflows
androidbuildmcp tools
```

After connecting, ask the agent to list AndroidBuildMCP tools or call the `doctor` tool. If tools are missing, confirm the project `.androidbuildmcp/config.yaml` enables their workflow, then restart the MCP server.

## Project configuration

The MCP client config determines how the server process starts. The application repository and enabled tools are configured separately by `.androidbuildmcp/config.yaml`. Run `androidbuildmcp setup` from the app repository root to create that file.

## Android Studio limitation

Android Studio's documented MCP client currently does not support stdio connections, while AndroidBuildMCP currently provides stdio only. Direct Android Studio connection requires a future Streamable HTTP transport or a reviewed bridge. See [agent-setup.md](./agent-setup.md#9-android-studio-with-gemini).
