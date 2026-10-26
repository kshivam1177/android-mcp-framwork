import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { execCommand } from '../../utils/exec.js';
import { loadConfig } from '../../config/loader.js';
import type { ToolModule } from '../types.js';

export const toolName = 'android_cli_studio_analyze_file';
export const workflow = 'android-cli';

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Analyze File in Android Studio',
    description: 'Run Android Studio inspections on a project file through Google Android CLI. Requires a compatible Android Studio instance with the project open.',
    inputSchema: {
      filePath: z.string().min(1).describe('File path relative to the project root or an absolute path.'),
      workingDirectory: z.string().optional().describe('Android project root; defaults to current directory.'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, withErrorHandling(async ({ filePath, workingDirectory }) => {
    if (filePath.includes('\0')) throw new Error('filePath contains an invalid null character.');
    const result = await execCommand(loadConfig().paths.androidCliPath, ['studio', 'analyze-file', filePath], { cwd: workingDirectory, timeoutMs: 90_000 });
    const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n');
    if (result.exitCode !== 0) throw new Error(`Android Studio file analysis failed (exit ${result.exitCode}): ${output}`);
    return textResult(output || 'Android Studio analysis completed with no output.', { exitCode: result.exitCode, durationMs: result.durationMs });
  }));
}
const mod: ToolModule = { toolName, workflow, register };
export default mod;
