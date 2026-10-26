import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { validateTestPlan } from '../../testing-intelligence/instructions.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import type { ToolModule } from '../types.js';

export const toolName = 'validate_test_plan';
export const workflow = 'testing-intelligence';

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Validate Test Plan',
    description: 'Validate a proposed natural-language test plan before execution. Incomplete plans are returned as blocked with a reason; this tool does not execute any action.',
    inputSchema: {
      plan: z.record(z.unknown()).describe('Object with a non-empty goal and an array of explicit steps, each containing a non-empty action.'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, withErrorHandling(async (args: { plan: Record<string, unknown> }) => {
    const result = validateTestPlan(args.plan);
    return textResult(JSON.stringify(result, null, 2), result);
  }));
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
