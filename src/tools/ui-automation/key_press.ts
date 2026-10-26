import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTargetAndBackend } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'key_press';
export const workflow = 'ui-automation';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Key Press',
      description:
        'Send one hardware/software key event (adb shell input keyevent). Accepts either a symbolic Android keycode name (KEYCODE_BACK, KEYCODE_ENTER, KEYCODE_DEL, KEYCODE_TAB) or its numeric code. Prefer button for common hardware buttons (home/back/recents/power/volume) - it maps friendly names for you.',
      inputSchema: {
        keyCode: z.string().describe('e.g. "KEYCODE_ENTER" or "66".'),
        targetId: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(async (args: { keyCode: string; targetId?: string }) => {
      const { target, backend } = await resolveTargetAndBackend(args.targetId);
      await backend.keyEvent(target.id, args.keyCode);
      return textResult(`Sent ${args.keyCode} to ${target.id}.`, { target, keyCode: args.keyCode });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
