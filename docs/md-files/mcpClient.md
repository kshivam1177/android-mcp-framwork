# MCP client configuration

AndroidMCP Framwork currently runs as a local **stdio MCP server**. It uses the package/CLI name `androidmcp-framework` and starts with the `mcp` command. For a client-specific walkthrough, see [MCP integration guide](./mcp-guide.md).

## Generic configuration

Clients using the common `mcpServers` schema can use:

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

For VS Code's `.vscode/mcp.json` schema, use a top-level `servers` object:

```json
{
  "servers": {
    "androidmcp-framwork": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "androidmcp-framework@latest", "mcp"]
    }
  }
}
```

## Verify installation

Run these in a terminal, not inside the MCP configuration:

```bash
node --version
npx -y androidmcp-framework@latest --help
npx -y androidmcp-framework@latest doctor
npx -y androidmcp-framework@latest workflows
npx -y androidmcp-framework@latest tools
```

Then restart/reload the MCP client and ask it to list the AndroidMCP Framwork tools or call the available doctor tool.

## Project configuration is separate

The MCP client configuration only starts the server. It does not configure which project or workflows should be used. From the Android app repository root, run:

```bash
npx -y androidmcp-framework@latest setup
```

Review the generated `.android-build-mcp/config.yaml`, especially `enabledWorkflows` and `sessionDefaults`. Restart the MCP client after changing configuration.

## Current transport limitation

This release supports stdio only. Do not use an HTTP URL or assume a built-in HTTP listener exists. Direct Android Studio Gemini integration requires a supported HTTP transport or a separately reviewed bridge; see [Supported clients](./supportedclients.md#transport-and-protocol-scope).
