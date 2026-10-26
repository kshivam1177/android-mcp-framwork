import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { resolveInstructions, type ScopedInstructions } from '../../testing-intelligence/instructions.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import type { ToolModule } from '../types.js';

export const toolName = 'resolve_test_instructions';
export const workflow = 'testing-intelligence';

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Resolve Layered Test Instructions',
    description: 'Merge global, project, feature, and run-specific test instructions from least to most specific. Nested objects merge recursively; arrays and scalar values are overridden by more specific scopes. This resolves configuration only and does not execute tests.',
    inputSchema: {
      layers: z.array(z.object({
        scope: z.enum(['global', 'project', 'feature', 'run']),
        values: z.record(z.unknown()),
      })).describe('Instruction layers. More specific scopes override less specific scopes.'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, withErrorHandling(async (args: { layers: ScopedInstructions[] }) => {
    const result = resolveInstructions(args.layers);
    return textResult(JSON.stringify(result, null, 2), result as unknown as Record<string, unknown>);
  }));
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
