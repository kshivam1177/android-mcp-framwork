import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTarget, getAdbPath } from '../../utils/adb.js';
import { startBackgroundProcess } from '../../utils/processRegistry.js';
import type { ToolModule } from '../types.js';

export const toolName = 'start_log_capture';
export const workflow = 'debugging';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Start Log Capture',
      description: 'Start streaming logcat from the resolved target to a background buffer. Returns a processId - pass it to stop_log_capture to retrieve everything captured and end the stream.',
      inputSchema: {
        targetId: z.string().optional(),
        filterSpec: z.string().optional().describe('adb logcat filter-spec, e.g. "MyApp:D *:S" to show only MyApp debug+ logs.'),
        packageId: z.string().optional().describe('If given, filters to this package\'s PID via --pid (resolved at capture start, not re-resolved on app restart).'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(async (args: { targetId?: string; filterSpec?: string; packageId?: string }) => {
      const target = await resolveTarget({ requestedId: args.targetId });
      const cliArgs = ['-s', target.id, 'logcat'];
      if (args.filterSpec) cliArgs.push(...args.filterSpec.split(/\s+/));
      const tracked = startBackgroundProcess(getAdbPath(), cliArgs, { targetId: target.id, kind: 'logcat' });
      return textResult(`Capturing logcat from ${target.id}.`, { target, processId: tracked.id });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
