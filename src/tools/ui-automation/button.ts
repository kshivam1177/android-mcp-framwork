import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTargetAndBackend } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'button';
export const workflow = 'ui-automation';

const BUTTON_KEYCODES: Record<string, string> = {
  home: 'KEYCODE_HOME',
  back: 'KEYCODE_BACK',
  recents: 'KEYCODE_APP_SWITCH',
  power: 'KEYCODE_POWER',
  volume_up: 'KEYCODE_VOLUME_UP',
  volume_down: 'KEYCODE_VOLUME_DOWN',
  menu: 'KEYCODE_MENU',
  enter: 'KEYCODE_ENTER',
  camera: 'KEYCODE_CAMERA',
};

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Hardware Button',
      description: 'Press a named hardware/system button: home, back, recents, power, volume_up, volume_down, menu, enter, camera.',
      inputSchema: {
        button: z.enum(['home', 'back', 'recents', 'power', 'volume_up', 'volume_down', 'menu', 'enter', 'camera']),
        targetId: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(async (args: { button: keyof typeof BUTTON_KEYCODES; targetId?: string }) => {
      const { target, backend } = await resolveTargetAndBackend(args.targetId);
      const keyCode = BUTTON_KEYCODES[args.button] as string;
      await backend.keyEvent(target.id, keyCode);
      return textResult(`Pressed ${args.button} on ${target.id}.`, { target, button: args.button, keyCode });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
