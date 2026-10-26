import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { runAdbShell } from '../../utils/adb.js';
import { resolveTargetAndBackend } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'touch';
export const workflow = 'ui-automation';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Touch (raw down/up/move)',
      description:
        'Send a raw touch event (adb shell input motionevent) rather than a full tap/swipe gesture. Use for composing custom multi-point sequences - e.g. DOWN, several MOVEs, then UP - that the higher-level tap/swipe/drag tools don\'t expose.',
      inputSchema: {
        x: z.number(),
        y: z.number(),
        action: z.enum(['down', 'up', 'move']),
        targetId: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(async (args: { x: number; y: number; action: 'down' | 'up' | 'move'; targetId?: string }) => {
      const { target } = await resolveTargetAndBackend(args.targetId);
      await runAdbShell(target.id, ['input', 'motionevent', args.action.toUpperCase(), String(args.x), String(args.y)]);
      return textResult(`Sent ${args.action.toUpperCase()} at (${args.x}, ${args.y}) to ${target.id}.`, { target });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
