import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTarget, runAdbShell } from '../../utils/adb.js';
import type { ToolModule } from '../types.js';

export const toolName = 'set_emulator_appearance';
export const workflow = 'emulator-management';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Set Appearance (Dark/Light Mode)',
      description: 'Toggle system dark/light theme on the resolved target (adb shell cmd uimode night yes|no). Needs API 29+ (Android 10+).',
      inputSchema: {
        mode: z.enum(['dark', 'light']),
        targetId: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { mode: 'dark' | 'light'; targetId?: string }) => {
      const target = await resolveTarget({ requestedId: args.targetId });
      await runAdbShell(target.id, ['cmd', 'uimode', 'night', args.mode === 'dark' ? 'yes' : 'no']);
      return textResult(`Set ${args.mode} mode on ${target.id}.`, { target, mode: args.mode });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
