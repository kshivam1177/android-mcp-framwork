import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { resolveUniqueUiNode, type UiSelector } from '../../automation/formAutomation.js';
import { parseUiHierarchy } from '../../automation/uiHierarchy.js';
import { runAdbShell } from '../../utils/adb.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTargetAndBackend } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'fill_form';
export const workflow = 'ui-automation';

const selectorSchema = z.object({
  resourceId: z.string().optional(),
  contentDesc: z.string().optional(),
  textContains: z.string().optional(),
}).refine((selector) => Boolean(selector.resourceId || selector.contentDesc || selector.textContains), {
  message: 'Provide at least one selector: resourceId, contentDesc, or textContains.',
});
const fieldSchema = z.object({
  name: z.string().min(1),
  selector: selectorSchema,
  value: z.string(),
});

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Fill Form',
      description: 'Fill visible Android form fields using semantic UI selectors, optionally clear existing text, and optionally tap a uniquely identified submit button. Refreshes the hierarchy between fields. Ambiguous or missing matches fail safely.',
      inputSchema: {
        targetId: z.string().optional(),
        fields: z.array(fieldSchema).min(1).max(40).describe('Form fields with a unique selector and value.'),
        clearExisting: z.boolean().optional().describe('Clear existing text before typing (default true; sends up to 200 delete key events).'),
        submit: selectorSchema.optional().describe('Optional unique submit button selector, tapped after all fields are filled.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(async (args: {
      targetId?: string;
      fields: Array<{ name: string; selector: UiSelector; value: string }>;
      clearExisting?: boolean;
      submit?: UiSelector;
    }) => {
      const { target, backend } = await resolveTargetAndBackend(args.targetId);
      const outcomes: Array<{ field: string; status: string }> = [];
      let nodes = parseUiHierarchy(await backend.dumpHierarchy(target.id));

      for (const field of args.fields) {
        const node = resolveUniqueUiNode(nodes, field.selector, field.name, 'field');
        await backend.tap(target.id, node.centerX, node.centerY);
        if (args.clearExisting !== false) {
          await runAdbShell(target.id, [
            'input', 'keyevent', 'KEYCODE_MOVE_END', ...Array.from({ length: 200 }, () => 'KEYCODE_DEL'),
          ], { timeoutMs: 15000 });
        }
        await backend.typeText(target.id, field.value);
        outcomes.push({ field: field.name, status: 'input-issued' });
        nodes = parseUiHierarchy(await backend.dumpHierarchy(target.id));
      }

      let submitStatus: { status: string; center: { x: number; y: number } } | undefined;
      if (args.submit) {
        const button = resolveUniqueUiNode(nodes, args.submit, 'submit button', 'button');
        await backend.tap(target.id, button.centerX, button.centerY);
        submitStatus = { status: 'action-issued', center: { x: button.centerX, y: button.centerY } };
      }

      const result = { targetId: target.id, backend: backend.name, success: true, outcomes, submit: submitStatus, verifyFollowUp: true };
      return textResult(JSON.stringify(result, null, 2), result);
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
