import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { execCommand } from '../../utils/exec.js';
import { loadConfig } from '../../config/loader.js';
import type { ToolModule } from '../types.js';

export const toolName = 'android_cli_info';
export const workflow = 'android-cli';

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Android CLI Environment Info',
    description: 'Report Android CLI environment details (SDK path, connected devices, configuration). Requires Google Android CLI 1.0+ installed separately.',
    inputSchema: { workingDirectory: z.string().optional().describe('Optional Android project directory. Defaults to the current process directory.') },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, withErrorHandling(async ({ workingDirectory }) => {
    const config = loadConfig();
    const result = await execCommand(config.paths.androidCliPath, ['info'], { cwd: workingDirectory, timeoutMs: 30_000 });
    if (result.exitCode !== 0) throw new Error(`android info failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`);
    return textResult(result.stdout || result.stderr, { exitCode: result.exitCode, durationMs: result.durationMs });
  }));
}
const mod: ToolModule = { toolName, workflow, register };
export default mod;
