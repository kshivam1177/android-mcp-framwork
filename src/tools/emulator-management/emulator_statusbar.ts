import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTarget, runAdbShell } from '../../utils/adb.js';
import type { ToolModule } from '../types.js';

export const toolName = 'emulator_statusbar';
export const workflow = 'emulator-management';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Status Bar Demo Mode',
      description:
        'Enter or exit system-ui "demo mode" for clean screenshots: fixed 12:00 clock, full battery, full signal/wifi, notifications hidden. Uses the same android.permission-free demo-mode broadcasts every screenshot tool relies on.',
      inputSchema: {
        action: z.enum(['enter', 'exit']),
        targetId: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { action: 'enter' | 'exit'; targetId?: string }) => {
      const target = await resolveTarget({ requestedId: args.targetId });
      const shell = (a: string[]) => runAdbShell(target.id, a);

      if (args.action === 'exit') {
        await shell(['am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'exit']);
        return textResult(`Exited demo mode on ${target.id}.`, { target });
      }

      await shell(['settings', 'put', 'global', 'sysui_demo_allowed', '1']);
      await shell(['am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'enter']);
      await shell(['am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'clock', '-e', 'hhmm', '1200']);
      await shell(['am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'battery', '-e', 'level', '100', '-e', 'plugged', 'false']);
      await shell(['am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'network', '-e', 'wifi', 'show', '-e', 'level', '4']);
      await shell(['am', 'broadcast', '-a', 'com.android.systemui.demo', '-e', 'command', 'notifications', '-e', 'visible', 'false']);
      return textResult(`Entered demo mode on ${target.id} (12:00, full battery, full signal, no notifications).`, { target });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
