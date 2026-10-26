import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTarget, runAdbForTarget } from '../../utils/adb.js';
import type { ToolModule } from '../types.js';

export const toolName = 'push_file_device';
export const workflow = 'device';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Push File',
      description: 'Copy a local file or directory onto the resolved target (adb push).',
      inputSchema: {
        localPath: z.string(),
        remotePath: z.string(),
        targetId: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { localPath: string; remotePath: string; targetId?: string }) => {
      const target = await resolveTarget({ requestedId: args.targetId });
      const result = await runAdbForTarget(target.id, ['push', args.localPath, args.remotePath], { timeoutMs: 300_000 });
      return textResult(`Pushed ${args.localPath} -> ${args.remotePath} on ${target.id}.\n\n${result.stdout}`, { target });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
