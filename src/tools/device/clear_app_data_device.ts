import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTarget, runAdbShell } from '../../utils/adb.js';
import type { ToolModule } from '../types.js';

export const toolName = 'clear_app_data_device';
export const workflow = 'device';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Clear App Data',
      description: "Reset an app to first-install state on the resolved target (adb shell pm clear) - wipes the app's data and cache without uninstalling it.",
      inputSchema: {
        packageId: z.string(),
        targetId: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { packageId: string; targetId?: string }) => {
      const target = await resolveTarget({ requestedId: args.targetId });
      await runAdbShell(target.id, ['pm', 'clear', args.packageId]);
      return textResult(`Cleared data for ${args.packageId} on ${target.id}.`, { target, packageId: args.packageId });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
