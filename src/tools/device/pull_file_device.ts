import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTarget, runAdbForTarget } from '../../utils/adb.js';
import type { ToolModule } from '../types.js';

export const toolName = 'pull_file_device';
export const workflow = 'device';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Pull File',
      description: 'Copy a file or directory off the resolved target onto the local filesystem (adb pull).',
      inputSchema: {
        remotePath: z.string(),
        localPath: z.string(),
        targetId: z.string().optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { remotePath: string; localPath: string; targetId?: string }) => {
      const target = await resolveTarget({ requestedId: args.targetId });
      const result = await runAdbForTarget(target.id, ['pull', args.remotePath, args.localPath], { timeoutMs: 300_000 });
      return textResult(`Pulled ${args.remotePath} -> ${args.localPath} from ${target.id}.\n\n${result.stdout}`, { target });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
