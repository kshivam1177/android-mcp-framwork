import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTarget, runAdbForTarget, runAdbShell } from '../../utils/adb.js';
import type { ToolModule } from '../types.js';

export const toolName = 'get_anr_trace';
export const workflow = 'debugging';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Get ANR Trace',
      description:
        'Find "ANR in <package>" entries in logcat (system_server\'s standard signal for a hang), and try to also pull matching files from /data/anr/. The /data/anr/ read can fail with permission denied on a non-debuggable, production-signed physical device - that\'s a real platform restriction, not a bug, and the logcat-based result still comes back either way.',
      inputSchema: {
        targetId: z.string().optional(),
        packageId: z.string().optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { targetId?: string; packageId?: string }) => {
      const target = await resolveTarget({ requestedId: args.targetId });
      const logResult = await runAdbForTarget(target.id, ['logcat', '-d'], { timeoutMs: 30_000 });
      const anrLines = logResult.stdout
        .split('\n')
        .filter((line) => /ANR in/i.test(line) && (!args.packageId || line.includes(args.packageId)));

      let anrFiles: string[] = [];
      let anrFilesError: string | undefined;
      try {
        const listing = await runAdbShell(target.id, ['ls', '/data/anr/'], { timeoutMs: 10_000 });
        anrFiles = listing.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
      } catch (err) {
        anrFilesError = err instanceof Error ? err.message : String(err);
      }

      const summary =
        anrLines.length > 0
          ? anrLines.join('\n')
          : '(no "ANR in" entries found in the current logcat buffer - it may have rotated out; try reproducing the hang again first)';

      return textResult(summary, { target, anrFiles, anrFilesError });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
