export interface ToolContext {
  cwd?: string;
  deviceSerial?: string;
  configPath?: string;
}

export interface ToolDefinition<T = unknown> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: T, context?: ToolContext) => Promise<unknown>;
}
