import type { JsonValue } from './types.js';

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: string[];
  metadata?: Record<string, JsonValue>;
}

const workflows = new Map<string, WorkflowDefinition>();

export function registerWorkflow(workflow: WorkflowDefinition): void {
  workflows.set(workflow.id, workflow);
}

export function listWorkflows(): WorkflowDefinition[] {
  return [...workflows.values()];
}

export function getWorkflow(id: string): WorkflowDefinition | undefined {
  return workflows.get(id);
}
