import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { stopTrackedProcess, readCapturedLog } from '../../utils/processRegistry.js';
import type { ToolModule } from '../types.js';

export const toolName = 'stop_log_capture';
export const workflow = 'debugging';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Stop Log Capture',
      description: 'Stop a log capture started by start_log_capture and return everything buffered (tail, if very large).',
      inputSchema: { processId: z.string() },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { processId: string }) => {
      const log = readCapturedLog(args.processId);
      const { logFilePath } = stopTrackedProcess(args.processId);
      return textResult(log || '(no output captured)', { logFilePath, byteLength: log.length });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
