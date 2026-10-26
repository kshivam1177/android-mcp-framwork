# Supported coding agents and MCP clients

AndroidBuildMCP currently exposes a local **stdio MCP server**. It can connect to MCP clients that launch local stdio processes. Direct Android Studio MCP integration is not currently supported because Android Studio's documented MCP integration does not support stdio; it requires HTTP transport.

| Client | Current status | Configuration location / method |
|---|---|---|
| Claude Code | Supported (stdio) | `claude mcp add ...` or project `.mcp.json` |
| OpenAI Codex CLI / IDE extension | Supported (stdio) | `codex mcp add ...` or `~/.codex/config.toml` |
| Google Gemini CLI | Supported (stdio) | `.gemini/settings.json` or `~/.gemini/settings.json` |
| Google Antigravity IDE / CLI | Supported (stdio) | `.agents/mcp_config.json` or `~/.gemini/config/mcp_config.json` |
| VS Code + GitHub Copilot Agent mode | Supported (stdio) | Prefer workspace `.mcp.json`; `.vscode/mcp.json` is also supported |
| Android Studio Gemini | Not directly supported yet | Requires Streamable HTTP transport or a reviewed stdio-to-HTTP bridge |
| Any other MCP client | Depends on stdio support | Configure `npx -y androidbuildmcp@latest mcp` if it supports local stdio servers |

## Important distinction

MCP client compatibility means the client can discover and call the current server's tools. It does **not** mean every planned natural-language testing capability is implemented. The testing-intelligence workflow currently provides early project analysis, persistent instruction writing, and report writing; the full adaptive test generation/execution lifecycle remains roadmap work.

See [agent-setup.md](./agent-setup.md) for copy/paste configurations, troubleshooting, and example prompts.
