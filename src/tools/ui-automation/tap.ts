import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveElementRef } from '../../automation/uiHierarchy.js';
import { resolveTargetAndBackend } from './_shared.js';
import { AndroidBuildMcpError } from '../../types.js';
import type { ToolModule } from '../types.js';

export const toolName = 'tap';
export const workflow = 'ui-automation';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Tap',
      description: 'Tap either a raw (x, y) point or an elementRef from the latest snapshot_ui output. Prefer elementRef - it survives minor layout shifts that would break a hard-coded coordinate.',
      inputSchema: {
        elementRef: z.string().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        targetId: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(async (args: { elementRef?: string; x?: number; y?: number; targetId?: string }) => {
      const { target, backend } = await resolveTargetAndBackend(args.targetId);
      let x = args.x;
      let y = args.y;
      if (args.elementRef) {
        const node = resolveElementRef(target.id, args.elementRef);
        x = node.centerX;
        y = node.centerY;
      }
      if (x === undefined || y === undefined) {
        throw new AndroidBuildMcpError('INVALID_CONFIG', 'Provide either elementRef, or both x and y.');
      }
      await backend.tap(target.id, x, y);
      return textResult(`Tapped (${x}, ${y}) on ${target.id}.`, { target, x, y, backend: backend.name });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
