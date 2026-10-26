import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { clearSessionDefaults, getActiveProfileName } from '../../session/defaults.js';
import type { ToolModule } from '../types.js';

export const toolName = 'session_clear_defaults';
export const workflow = 'session-management';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Clear Session Defaults',
      description: 'Clear runtime overrides for the active profile (or a named one) - falls back to config.yaml\'s static sessionDefaults on the next read, not to nothing.',
      inputSchema: { profile: z.string().optional() },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { profile?: string }) => {
      const profile = args.profile ?? getActiveProfileName();
      clearSessionDefaults(args.profile);
      return textResult(`Cleared runtime overrides for profile "${profile}".`, { profile });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
