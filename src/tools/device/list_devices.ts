import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { listTargets } from '../../utils/adb.js';
import type { ToolModule } from '../types.js';

export const toolName = 'list_devices';
export const workflow = 'device';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'List Devices',
      description:
        "List every connected Android target - booted emulators and physical devices together, the same way `adb devices -l` does. Each entry reports id (adb serial), type ('emulator'|'physical'), state, and avdName when resolvable.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    withErrorHandling(async () => {
      const targets = await listTargets();
      return textResult(JSON.stringify(targets, null, 2), { targets });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
