import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { execCommand } from '../../utils/exec.js';
import { findAvdmanager, parseAvdManagerListOutput } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'list_avds';
export const workflow = 'emulator-management';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'List AVDs',
      description: 'List every configured Android Virtual Device (avdmanager list avd) - not just the ones currently booted. Use list_devices for what\'s actually running.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async () => {
      const result = await execCommand(findAvdmanager(), ['list', 'avd']);
      const avds = parseAvdManagerListOutput(result.stdout);
      return textResult(JSON.stringify(avds, null, 2), { avds });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
