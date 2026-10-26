import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { execCommand } from '../../utils/exec.js';
import { loadConfig } from '../../config/loader.js';
import type { ToolModule } from '../types.js';

export const toolName = 'android_cli_studio_check';
export const workflow = 'android-cli';

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Check Android Studio Bridge',
    description: 'Check whether Google Android CLI can connect to a running supported Android Studio instance and list its open projects.',
    inputSchema: { workingDirectory: z.string().optional().describe('Optional Android project directory for automatic project selection.') },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, withErrorHandling(async ({ workingDirectory }) => {
    const result = await execCommand(loadConfig().paths.androidCliPath, ['studio', 'check'], { cwd: workingDirectory, timeoutMs: 30_000 });
    const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n');
    if (result.exitCode !== 0) throw new Error(`android studio check failed (exit ${result.exitCode}): ${output}`);
    return textResult(output || 'Android Studio bridge check completed with no output.', { exitCode: result.exitCode, durationMs: result.durationMs });
  }));
}
const mod: ToolModule = { toolName, workflow, register };
export default mod;
