import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { stopTrackedProcess, readCapturedLog } from '../../utils/processRegistry.js';
import type { ToolModule } from '../types.js';

export const toolName = 'gradle_module_stop';
export const workflow = 'gradle-module';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Stop Gradle Module Run',
      description: 'Stop a background process started by gradle_module_run and return its captured output.',
      inputSchema: { processId: z.string() },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { processId: string }) => {
      const log = readCapturedLog(args.processId);
      stopTrackedProcess(args.processId);
      return textResult(log || '(no output captured)', { byteLength: log.length });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
