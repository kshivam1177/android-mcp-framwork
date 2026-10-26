import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTarget, runAdbForTarget } from '../../utils/adb.js';
import type { ToolModule } from '../types.js';

export const toolName = 'uninstall_app_device';
export const workflow = 'device';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Uninstall App',
      description: 'Uninstall an app (and its data) from the resolved target.',
      inputSchema: {
        packageId: z.string(),
        targetId: z.string().optional(),
        keepData: z.boolean().optional().describe('Pass -k to adb uninstall to keep app data/cache. Default false.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { packageId: string; targetId?: string; keepData?: boolean }) => {
      const target = await resolveTarget({ requestedId: args.targetId });
      const flags = args.keepData ? ['-k'] : [];
      const result = await runAdbForTarget(target.id, ['uninstall', ...flags, args.packageId]);
      return textResult(`${result.stdout.trim() || 'Uninstalled'} - ${args.packageId} on ${target.id}.`, { target });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
