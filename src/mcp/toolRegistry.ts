import type { ToolDefinition } from '../tools/types.js';

const tools: ToolDefinition[] = [];
let registered = false;

export function registerTool(tool: ToolDefinition): void {
  const existing = tools.findIndex(item => item.name === tool.name);
  if (existing >= 0) tools[existing] = tool; else tools.push(tool);
}

export function registerTools(): void {
  if (registered) return;
  registered = true;
}

export function getTools(): ToolDefinition[] { return [...tools]; }
