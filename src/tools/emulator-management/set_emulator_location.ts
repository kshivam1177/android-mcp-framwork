import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTarget, runAdbForTarget } from '../../utils/adb.js';
import type { ToolModule } from '../types.js';

export const toolName = 'set_emulator_location';
export const workflow = 'emulator-management';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Set Emulator Location',
      description: 'Fake the GPS location on a booted emulator via the emulator console (adb emu geo fix). Emulator-only - physical devices have no console to fix location on.',
      inputSchema: {
        latitude: z.number(),
        longitude: z.number(),
        targetId: z.string().optional().describe('Must be an emulator serial. Auto-resolved if omitted.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { latitude: number; longitude: number; targetId?: string }) => {
      const target = await resolveTarget({ requestedId: args.targetId });
      // Console command order is (longitude, latitude), matching GPS
      // coordinate-pair convention - easy to get backwards.
      await runAdbForTarget(target.id, ['emu', 'geo', 'fix', String(args.longitude), String(args.latitude)]);
      return textResult(`Set location on ${target.id} to ${args.latitude}, ${args.longitude}.`, { target });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
