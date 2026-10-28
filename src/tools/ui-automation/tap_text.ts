import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTargetAndBackend, dumpHierarchyWithRetry, resolveTextNode } from './_shared.js';
import type { ToolModule } from '../types.js';
import { parseKeyboardVisibility } from './is_keyboard_visible.js';
import { runAdbShell } from '../../utils/adb.js';
export const toolName = 'tap_text';
export const workflow = 'ui-automation';
export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Tap Text',
    description: 'Resolve visible text/content description from Android accessibility hierarchy and tap its bounds center. Does not require OCR. Ambiguous matches fail safely.',
    inputSchema: { text: z.string().min(1), exact: z.boolean().optional().default(false), autoHideKeyboard: z.boolean().optional().default(false).describe('If true and the keyboard is visible, dismiss it first, then refresh and re-resolve text bounds before tapping.'), targetId: z.string().optional() },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, withErrorHandling(async (args: { text: string; exact?: boolean; autoHideKeyboard?: boolean; targetId?: string }) => {
    const { target, backend } = await resolveTargetAndBackend(args.targetId);
    let keyboardDismissed = false;
    if (args.autoHideKeyboard) {
      const state = await runAdbShell(target.id, ['dumpsys', 'input_method'], { timeoutMs: 10000 });
      if (parseKeyboardVisibility(state.stdout) === true) {
        await backend.keyEvent(target.id, 'KEYCODE_ESCAPE');
        keyboardDismissed = true;
      }
    }
    // Always capture a fresh hierarchy after a potential keyboard dismissal,
    // since the keyboard can change the viewport and element coordinates.
    const xml = await dumpHierarchyWithRetry(backend, target.id);
    const node = resolveTextNode(xml, args.text, args.exact === true);
    await backend.tap(target.id, node.centerX, node.centerY);
    return textResult('Tapped text "' + args.text + '" on ' + target.id + '.', { targetId: target.id, text: args.text, matchedText: node.text, contentDesc: node.contentDesc, resourceId: node.resourceId, x: node.centerX, y: node.centerY, bounds: node.bounds, resolution: 'accessibility-hierarchy', keyboardDismissed });
  }));
}
const mod: ToolModule = { toolName, workflow, register };
export default mod;
