import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { listTargets } from '../../utils/adb.js';
import { startBackgroundProcess } from '../../utils/processRegistry.js';
import { findEmulatorBinary, waitForNewEmulator } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'open_emulator';
export const workflow = 'emulator-management';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Open Emulator (Visible Window)',
      description:
        "Ensure an AVD is running with a visible window, for manual/visual workflows. If it's already running headless, a window can't be attached after the fact - this reports that and leaves it running rather than restarting it out from under you.",
      inputSchema: { avdName: z.string(), timeoutMs: z.number().optional() },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(async (args: { avdName: string; timeoutMs?: number }) => {
      const before = await listTargets();
      const running = before.find((t) => t.type === 'emulator' && t.avdName === args.avdName);
      if (running) {
        return textResult(
          `"${args.avdName}" is already running as ${running.id}. If it was booted headless, restart it (erase_emulator or kill it manually, then boot_emulator with headless:false) to get a visible window.`,
          { target: running, alreadyRunning: true }
        );
      }
      const tracked = startBackgroundProcess(findEmulatorBinary(), ['-avd', args.avdName], {
        targetId: args.avdName,
        kind: 'emulator',
      });
      const target = await waitForNewEmulator(before, args.timeoutMs ?? 120_000);
      return textResult(`Opened "${args.avdName}" as ${target.id} with a visible window.`, { target, processId: tracked.id });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
