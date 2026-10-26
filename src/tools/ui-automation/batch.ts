import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveElementRef } from '../../automation/uiHierarchy.js';
import { resolveTargetAndBackend } from './_shared.js';
import { AndroidBuildMcpError } from '../../types.js';
import type { ToolModule } from '../types.js';

export const toolName = 'batch';
export const workflow = 'ui-automation';

const StepSchema = z.object({
  action: z.enum(['tap', 'long_press', 'swipe', 'type_text', 'key_press']),
  elementRef: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  startX: z.number().optional(),
  startY: z.number().optional(),
  endX: z.number().optional(),
  endY: z.number().optional(),
  durationMs: z.number().optional(),
  text: z.string().optional(),
  keyCode: z.string().optional(),
});

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Batch',
      description:
        'Run several same-screen UI actions in one call, resolving the target once and reusing it for every step. Use for multiple taps/toggles with no intermediate assertion needed - if you need to check state between steps, call the individual tools instead so you can inspect each result.',
      inputSchema: {
        steps: z.array(StepSchema).min(1),
        targetId: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(async (args: { steps: z.infer<typeof StepSchema>[]; targetId?: string }) => {
      const { target, backend } = await resolveTargetAndBackend(args.targetId);
      const results: Array<{ step: number; action: string; ok: boolean; error?: string }> = [];

      for (let i = 0; i < args.steps.length; i++) {
        const step = args.steps[i] as z.infer<typeof StepSchema>;
        try {
          let x = step.x;
          let y = step.y;
          if (step.elementRef) {
            const node = resolveElementRef(target.id, step.elementRef);
            x = node.centerX;
            y = node.centerY;
          }

          switch (step.action) {
            case 'tap':
              if (x === undefined || y === undefined) throw new AndroidBuildMcpError('INVALID_CONFIG', 'tap needs elementRef or x/y.');
              await backend.tap(target.id, x, y);
              break;
            case 'long_press':
              if (x === undefined || y === undefined) throw new AndroidBuildMcpError('INVALID_CONFIG', 'long_press needs elementRef or x/y.');
              await backend.longPress(target.id, x, y, step.durationMs);
              break;
            case 'swipe':
              if (step.startX === undefined || step.startY === undefined || step.endX === undefined || step.endY === undefined) {
                throw new AndroidBuildMcpError('INVALID_CONFIG', 'swipe needs startX/startY/endX/endY.');
              }
              await backend.swipe(target.id, step.startX, step.startY, step.endX, step.endY, step.durationMs);
              break;
            case 'type_text':
              if (step.text === undefined) throw new AndroidBuildMcpError('INVALID_CONFIG', 'type_text needs text.');
              if (step.elementRef && x !== undefined && y !== undefined) await backend.tap(target.id, x, y);
              await backend.typeText(target.id, step.text);
              break;
            case 'key_press':
              if (!step.keyCode) throw new AndroidBuildMcpError('INVALID_CONFIG', 'key_press needs keyCode.');
              await backend.keyEvent(target.id, step.keyCode);
              break;
          }
          results.push({ step: i, action: step.action, ok: true });
        } catch (err) {
          results.push({ step: i, action: step.action, ok: false, error: err instanceof Error ? err.message : String(err) });
          break; // stop at first failure rather than continuing on an unknown UI state
        }
      }

      return textResult(JSON.stringify(results, null, 2), { target, results });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
