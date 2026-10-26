import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTarget, runAdbForTarget } from '../../utils/adb.js';
import type { ToolModule } from '../types.js';

export const toolName = 'clear_logs';
export const workflow = 'debugging';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Clear Logs',
      description: 'Clear the on-device logcat buffer (adb logcat -c) so the next capture starts from a clean slate.',
      inputSchema: { targetId: z.string().optional() },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { targetId?: string }) => {
      const target = await resolveTarget({ requestedId: args.targetId });
      await runAdbForTarget(target.id, ['logcat', '-c']);
      return textResult(`Cleared logcat buffer on ${target.id}.`, { target });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
