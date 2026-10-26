import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTargetAndBackend } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'hide_keyboard';
export const workflow = 'ui-automation';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Hide Keyboard',
      description: 'Dismiss the on-screen keyboard using KEYCODE_ESCAPE (111) by default, or KEYCODE_BACK (4) when strategy="back".',
      inputSchema: {
        targetId: z.string().optional(),
        strategy: z.enum(['escape', 'back']).optional().default('escape').describe('Use escape (KEYCODE_ESCAPE/111) by default; choose back (KEYCODE_BACK/4) if required by the app/device.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { targetId?: string; strategy?: 'escape' | 'back' }) => {
      const { target, backend } = await resolveTargetAndBackend(args.targetId);
      const keyCode = args.strategy === 'back' ? 'KEYCODE_BACK' : 'KEYCODE_ESCAPE';
      await backend.keyEvent(target.id, keyCode);
      return textResult(
        `Requested keyboard dismissal on ${target.id} using ${keyCode}.`,
        { targetId: target.id, strategy: args.strategy ?? 'escape', keyCode, numericKeyCode: keyCode === 'KEYCODE_BACK' ? 4 : 111 }
      );
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
