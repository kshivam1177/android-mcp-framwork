import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { listTargets } from '../../utils/adb.js';
import { startBackgroundProcess } from '../../utils/processRegistry.js';
import { findEmulatorBinary, waitForNewEmulator } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'boot_emulator';
export const workflow = 'emulator-management';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Boot Emulator',
      description:
        'Boot an AVD by name and wait until it reaches adb state "device". Boots headless (-no-window) by default - pass headless:false for a visible window (needs a display available on this machine).',
      inputSchema: {
        avdName: z.string(),
        headless: z.boolean().optional().describe('Default true.'),
        wipeData: z.boolean().optional(),
        extraArgs: z.array(z.string()).optional().describe('Extra raw emulator CLI flags.'),
        timeoutMs: z.number().optional().describe('How long to wait for "device" state. Default 120000.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(
      async (args: { avdName: string; headless?: boolean; wipeData?: boolean; extraArgs?: string[]; timeoutMs?: number }) => {
        const before = await listTargets();
        const cliArgs = ['-avd', args.avdName];
        if (args.headless !== false) cliArgs.push('-no-window', '-no-audio');
        if (args.wipeData) cliArgs.push('-wipe-data');
        if (args.extraArgs) cliArgs.push(...args.extraArgs);

        const tracked = startBackgroundProcess(findEmulatorBinary(), cliArgs, {
          targetId: args.avdName,
          kind: 'emulator',
        });
        const target = await waitForNewEmulator(before, args.timeoutMs ?? 120_000);
        return textResult(`Booted "${args.avdName}" as ${target.id}.`, { target, processId: tracked.id });
      }
    )
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
