# MCP client configuration

test-orbit currently runs as a local **stdio MCP server**. It uses the package/CLI name `test-orbit` and starts with the `mcp` command. For a client-specific walkthrough, see [MCP integration guide](./mcp-guide.md).

## Generic configuration

Clients using the common `mcpServers` schema can use:

```json
{
  "mcpServers": {
    "test-orbit": {
      "command": "npx",
      "args": ["-y", "test-orbit@latest", "mcp"]
    }
  }
}
```

For VS Code's `.vscode/mcp.json` schema, use a top-level `servers` object:

```json
{
  "servers": {
    "test-orbit": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "test-orbit@latest", "mcp"]
    }
  }
}
```

## Verify installation

Run these in a terminal, not inside the MCP configuration:

```bash
node --version
npx -y test-orbit@latest --help
npx -y test-orbit@latest doctor
npx -y test-orbit@latest workflows
npx -y test-orbit@latest tools
```

Then restart/reload the MCP client and ask it to list the test-orbit tools or call the available doctor tool.

## Project configuration is separate

The MCP client configuration only starts the server. It does not configure which project or workflows should be used. From the Android app repository root, run:

```bash
npx -y test-orbit@latest setup
```

Review the generated `.test-orbit/config.yaml`, especially `enabledWorkflows` and `sessionDefaults`. If the repository has legacy `.android-build-mcp/` or `.androidbuildmcp/` data, use `test-orbit setup --migrate` after reviewing it. Restart the MCP client after changing configuration.

## Current transport limitation

This release supports stdio only. Do not use an HTTP URL or assume a built-in HTTP listener exists. Direct Android Studio Gemini integration requires a supported HTTP transport or a separately reviewed bridge; see [Supported clients](./supportedclients.md#transport-and-protocol-scope).
