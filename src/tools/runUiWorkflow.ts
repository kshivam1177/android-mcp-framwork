import { z } from 'zod';
import type { ToolDefinition } from './types.js';
import { runUiWorkflow } from '../automation/uiWorkflow.js';

const Input = z.object({
  workflowFile: z.string().min(1).max(200),
  projectPath: z.string().optional(),
  deviceId: z.string().optional(),
});

export const runUiWorkflowTool: ToolDefinition = {
  name: 'run_ui_workflow',
  description: 'Execute a reusable JSON UI workflow stored under .android-build-mcp/workflows using Google Android CLI for semantic input/layout inspection. Screen definitions live under .android-build-mcp/screens and reports are written under .android-build-mcp/test-reports.',
  inputSchema: {
    type: 'object',
    properties: {
      workflowFile: { type: 'string', minLength: 1, maxLength: 200, description: 'JSON path relative to .android-build-mcp/workflows.' },
      projectPath: { type: 'string', description: 'Android project root; defaults to the current working directory.' },
      deviceId: { type: 'string', description: 'Optional Android device serial.' }
    },
    required: ['workflowFile'],
    additionalProperties: false
  },
  async handler(input, context) {
    const args = Input.parse(input);
    return runUiWorkflow({
      cwd: args.projectPath ?? context?.cwd ?? process.cwd(),
      workflowFile: args.workflowFile,
      deviceId: args.deviceId ?? context?.deviceSerial
    });
  }
};

export function registerUiWorkflowTool(register: (tool: ToolDefinition) => void): void {
  register(runUiWorkflowTool);
}
