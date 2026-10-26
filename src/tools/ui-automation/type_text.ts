import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveElementRef } from '../../automation/uiHierarchy.js';
import { resolveTargetAndBackend } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'type_text';
export const workflow = 'ui-automation';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Type Text',
      description:
        'Type text into whatever field currently has focus. If elementRef is given, taps it first to focus it, then types. Only ASCII-range and common Latin text renders reliably through adb input text - non-Latin scripts and emoji generally need an IME-level workaround this tool does not attempt.',
      inputSchema: {
        text: z.string(),
        elementRef: z.string().optional().describe('Tapped first to focus, if given.'),
        targetId: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(async (args: { text: string; elementRef?: string; targetId?: string }) => {
      const { target, backend } = await resolveTargetAndBackend(args.targetId);
      if (args.elementRef) {
        const node = resolveElementRef(target.id, args.elementRef);
        await backend.tap(target.id, node.centerX, node.centerY);
      }
      await backend.typeText(target.id, args.text);
      return textResult(`Typed text into ${target.id}.`, { target, length: args.text.length });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
