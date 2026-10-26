import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { runAdbShell } from '../../utils/adb.js';
import { resolveTargetAndBackend, getScreenSize, directionToCoords } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'gesture';
export const workflow = 'ui-automation';

const PRESETS = [
  'expand_notifications',
  'expand_quick_settings',
  'collapse_statusbar',
  'swipe_up_from_bottom',
  'swipe_down_from_top',
] as const;

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Gesture Preset',
      description:
        'Named system gesture presets: expand_notifications, expand_quick_settings, collapse_statusbar (all via `cmd statusbar`, no coordinates needed), swipe_up_from_bottom (home/app-switcher gesture-nav swipe), swipe_down_from_top (notification-shade swipe as an alternative to expand_notifications on older API levels).',
      inputSchema: {
        preset: z.enum(PRESETS),
        targetId: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(async (args: { preset: (typeof PRESETS)[number]; targetId?: string }) => {
      const { target, backend } = await resolveTargetAndBackend(args.targetId);

      switch (args.preset) {
        case 'expand_notifications':
          await runAdbShell(target.id, ['cmd', 'statusbar', 'expand-notifications']);
          break;
        case 'expand_quick_settings':
          await runAdbShell(target.id, ['cmd', 'statusbar', 'expand-settings']);
          break;
        case 'collapse_statusbar':
          await runAdbShell(target.id, ['cmd', 'statusbar', 'collapse']);
          break;
        case 'swipe_up_from_bottom': {
          const screen = await getScreenSize(target.id);
          const { startX, startY, endX, endY } = directionToCoords('up', screen, 0.5);
          await backend.swipe(target.id, startX, screen.height - 20, endX, screen.height * 0.4, 300);
          break;
        }
        case 'swipe_down_from_top': {
          const screen = await getScreenSize(target.id);
          await backend.swipe(target.id, screen.width / 2, 10, screen.width / 2, screen.height * 0.5, 300);
          break;
        }
      }

      return textResult(`Performed "${args.preset}" on ${target.id}.`, { target, preset: args.preset });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
