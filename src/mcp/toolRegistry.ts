import type { RegisteredTool } from '../tools/types.js';

const handlesByToolName = new Map<string, RegisteredTool>();
const toolNamesByWorkflow = new Map<string, string[]>();
const enabledWorkflows = new Set<string>();

export function registerHandle(toolName: string, workflow: string, handle: RegisteredTool): void {
  handlesByToolName.set(toolName, handle);
  const existing = toolNamesByWorkflow.get(workflow) ?? [];
  existing.push(toolName);
  toolNamesByWorkflow.set(workflow, existing);
}

export function markWorkflowEnabled(workflow: string): void {
  enabledWorkflows.add(workflow);
}

export function markWorkflowDisabled(workflow: string): void {
  enabledWorkflows.delete(workflow);
}

export function isWorkflowEnabled(workflow: string): boolean {
  return enabledWorkflows.has(workflow);
}

export function getWorkflowNames(): string[] {
  return Array.from(toolNamesByWorkflow.keys());
}

export function getToolNamesForWorkflow(workflow: string): string[] {
  return toolNamesByWorkflow.get(workflow) ?? [];
}

export function getHandle(toolName: string): RegisteredTool | undefined {
  return handlesByToolName.get(toolName);
}

export function getAllToolNames(): string[] {
  return Array.from(handlesByToolName.keys());
}
