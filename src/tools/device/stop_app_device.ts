import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTarget, runAdbShell } from '../../utils/adb.js';
import type { ToolModule } from '../types.js';

export const toolName = 'stop_app_device';
export const workflow = 'device';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Stop App',
      description: 'Force-stop a running app on the resolved target (adb shell am force-stop).',
      inputSchema: {
        packageId: z.string().describe('Application id, e.g. "com.example.app".'),
        targetId: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { packageId: string; targetId?: string }) => {
      const target = await resolveTarget({ requestedId: args.targetId });
      await runAdbShell(target.id, ['am', 'force-stop', args.packageId]);
      return textResult(`Stopped ${args.packageId} on ${target.id}.`, { target, packageId: args.packageId });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
