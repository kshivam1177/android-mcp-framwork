import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTarget, runAdbForTarget } from '../../utils/adb.js';
import type { ToolModule } from '../types.js';

export const toolName = 'get_crash_report';
export const workflow = 'debugging';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Get Crash Report',
      description:
        'Dump the dedicated logcat "crash" buffer (adb logcat -d -b crash), which holds uncaught Java/Kotlin exception traces separately from the main log. Optionally filter to lines mentioning a specific packageId.',
      inputSchema: {
        targetId: z.string().optional(),
        packageId: z.string().optional().describe('If given, only returns crash entries mentioning this package.'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { targetId?: string; packageId?: string }) => {
      const target = await resolveTarget({ requestedId: args.targetId });
      const result = await runAdbForTarget(target.id, ['logcat', '-d', '-b', 'crash'], { timeoutMs: 30_000 });
      let output = result.stdout;
      if (args.packageId) {
        output = output
          .split('\n')
          .filter((line) => line.includes(args.packageId as string))
          .join('\n');
      }
      return textResult(output.trim() || '(no crash entries found in the crash buffer)', { target });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
