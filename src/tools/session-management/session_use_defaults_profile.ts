import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { useProfile, getEffectiveSessionDefaults, listProfiles } from '../../session/defaults.js';
import type { ToolModule } from '../types.js';

export const toolName = 'session_use_defaults_profile';
export const workflow = 'session-management';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Switch Session Defaults Profile',
      description:
        'Switch the active session-defaults profile - useful in a monorepo with several Gradle projects, so each can keep its own remembered projectPath/module/variant/targetId without overwriting the others.',
      inputSchema: { profile: z.string() },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { profile: string }) => {
      useProfile(args.profile);
      const effective = getEffectiveSessionDefaults();
      return textResult(JSON.stringify({ activeProfile: args.profile, knownProfiles: listProfiles(), ...effective }, null, 2));
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
