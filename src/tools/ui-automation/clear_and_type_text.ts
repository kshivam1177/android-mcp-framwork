import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTargetAndBackend, dumpHierarchyWithRetry, resolveTextNode } from './_shared.js';
import { runAdbShell } from '../../utils/adb.js';
import type { ToolModule } from '../types.js';
export const toolName = 'clear_and_type_text';
export const workflow = 'ui-automation';
export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Clear and Type Text',
    description: 'Focus a field by accessibility text or coordinates, select all using Android input keycombination (Ctrl+A), delete, and type replacement text. Coordinates should be refreshed if the keyboard/layout changes.',
    inputSchema: { target: z.union([z.object({ x: z.number(), y: z.number() }), z.object({ text: z.string().min(1), exact: z.boolean().optional().default(false) })]), text: z.string(), targetId: z.string().optional() },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, withErrorHandling(async (args: { target: { x: number; y: number } | { text: string; exact?: boolean }; text: string; targetId?: string }) => {
    const { target, backend } = await resolveTargetAndBackend(args.targetId);
    let x: number; let y: number; let matchedText: string | undefined;
    if ('text' in args.target) {
      const xml = await dumpHierarchyWithRetry(backend, target.id);
      const node = resolveTextNode(xml, args.target.text, args.target.exact === true);
      x = node.centerX; y = node.centerY; matchedText = node.text ?? node.contentDesc;
    } else { x = args.target.x; y = args.target.y; }
    await backend.tap(target.id, x, y);
    await runAdbShell(target.id, ['input', 'keycombination', 'KEYCODE_CTRL_LEFT', 'KEYCODE_A'], { timeoutMs: 10000 });
    await backend.keyEvent(target.id, 'KEYCODE_DEL');
    await backend.typeText(target.id, args.text);
    return textResult('Replaced text in focused field on ' + target.id + '.', { targetId: target.id, x, y, matchedText, newLength: args.text.length, strategy: 'Ctrl+A then delete and type' });
  }));
}
const mod: ToolModule = { toolName, workflow, register };
export default mod;
