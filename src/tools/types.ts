import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export type RegisteredTool = ReturnType<McpServer['registerTool']>;

export interface ToolModule {
  toolName: string;
  workflow: string;
  register: (server: McpServer) => RegisteredTool;
}
