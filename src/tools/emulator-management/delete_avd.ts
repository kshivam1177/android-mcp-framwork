import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { execCommand } from '../../utils/exec.js';
import { findAvdmanager } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'delete_avd';
export const workflow = 'emulator-management';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Delete AVD',
      description: 'Permanently delete an Android Virtual Device and its data.',
      inputSchema: { name: z.string() },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { name: string }) => {
      const result = await execCommand(findAvdmanager(), ['delete', 'avd', '-n', args.name]);
      if (result.exitCode !== 0) {
        return textResult(`delete_avd failed:\n${result.stdout}\n${result.stderr}`);
      }
      return textResult(`Deleted AVD "${args.name}".`, { name: args.name });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
