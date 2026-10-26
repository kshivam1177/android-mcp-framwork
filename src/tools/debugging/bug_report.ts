import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTarget, runAdbForTarget } from '../../utils/adb.js';
import { getStateDir } from '../../utils/paths.js';
import type { ToolModule } from '../types.js';

export const toolName = 'bug_report';
export const workflow = 'debugging';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Bug Report',
      description:
        'Generate a full adb bugreport (system state, logs, dumpsys output for every service) and save it locally as a .zip. This is comprehensive but slow - budget 1-3 minutes.',
      inputSchema: {
        targetId: z.string().optional(),
        localOutputPath: z.string().optional().describe('Defaults to a path under the state dir.'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { targetId?: string; localOutputPath?: string }) => {
      const target = await resolveTarget({ requestedId: args.targetId });
      const dir = path.join(getStateDir(), 'bugreports');
      fs.mkdirSync(dir, { recursive: true });
      const outputPath = args.localOutputPath ?? path.join(dir, `bugreport-${target.id}-${Date.now()}.zip`);
      await runAdbForTarget(target.id, ['bugreport', outputPath], { timeoutMs: 240_000 });
      return textResult(`Saved bug report for ${target.id} to ${outputPath}.`, { target, outputPath });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
