import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { setSessionDefaults } from '../../session/defaults.js';
import type { ToolModule } from '../types.js';

export const toolName = 'session_set_defaults';
export const workflow = 'session-management';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Set Session Defaults',
      description:
        'Set one or more session defaults for the active profile at runtime (in-memory + persisted under the state dir for this profile - not written back to config.yaml). Only the fields you pass are changed; everything else stays as-is.',
      inputSchema: {
        projectPath: z.string().optional(),
        module: z.string().optional(),
        variant: z.string().optional(),
        targetId: z.string().optional(),
        avdName: z.string().optional(),
        applicationId: z.string().optional(),
        gradleTaskPrefix: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(
      async (args: {
        projectPath?: string;
        module?: string;
        variant?: string;
        targetId?: string;
        avdName?: string;
        applicationId?: string;
        gradleTaskPrefix?: string;
      }) => {
        const updated = setSessionDefaults(args);
        return textResult(JSON.stringify(updated, null, 2), updated);
      }
    )
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
