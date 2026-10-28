import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTargetAndBackend } from './_shared.js';
import { runAdbShell } from '../../utils/adb.js';
import type { ToolModule } from '../types.js';
export const toolName = 'is_keyboard_visible';
export const workflow = 'ui-automation';
export function parseKeyboardVisibility(output: string): boolean | null {
  for (const pattern of [/mInputShown\s*=\s*(true|false)/i, /mIsInputViewShown\s*=\s*(true|false)/i, /isInputViewShown\s*=\s*(true|false)/i, /showing\s*=\s*(true|false)/i]) {
    const match = output.match(pattern);
    if (match?.[1]) return match[1].toLowerCase() === 'true';
  }
  return null;
}
export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Check Keyboard Visibility',
    description: 'Inspect dumpsys input_method for keyboard visibility. Returns unknown if this Android/vendor build exposes no recognized field.',
    inputSchema: { targetId: z.string().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, withErrorHandling(async (args: { targetId?: string }) => {
    const { target } = await resolveTargetAndBackend(args.targetId);
    const result = await runAdbShell(target.id, ['dumpsys', 'input_method'], { timeoutMs: 10000 });
    const visible = parseKeyboardVisibility(result.stdout);
    return textResult(visible === null ? 'Keyboard visibility is unknown on ' + target.id + '.' : 'Keyboard is ' + (visible ? 'visible' : 'not visible') + ' on ' + target.id + '.', { targetId: target.id, visible, source: 'dumpsys input_method' });
  }));
}
const mod: ToolModule = { toolName, workflow, register };
export default mod;
