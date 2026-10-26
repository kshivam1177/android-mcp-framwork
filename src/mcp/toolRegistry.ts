import type { ToolDefinition } from '../tools/types.js';
import { registerTestingIntelligenceTools } from '../tools/testingIntelligence.js';

const tools: ToolDefinition[] = [];
let registered = false;

export function registerTool(tool: ToolDefinition): void {
  const existing = tools.findIndex(item => item.name === tool.name);
  if (existing >= 0) tools[existing] = tool; else tools.push(tool);
}

export function registerTools(): void {
  if (registered) return;
  registered = true;
  registerTestingIntelligenceTools(registerTool);
}

export function getTools(): ToolDefinition[] { return [...tools]; }
