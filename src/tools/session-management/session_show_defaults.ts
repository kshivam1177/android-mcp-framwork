import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { getEffectiveSessionDefaults } from '../../session/defaults.js';
import type { ToolModule } from '../types.js';

export const toolName = 'session_show_defaults';
export const workflow = 'session-management';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Show Session Defaults',
      description:
        'Show the active session-default profile and its resolved values (config.yaml sessionDefaults, overlaid with any runtime overrides from session_set_defaults). Call this before your first build/run/test call in a session - do not assume defaults are configured.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async () => {
      const effective = getEffectiveSessionDefaults();
      return textResult(JSON.stringify(effective, null, 2), { ...effective });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
