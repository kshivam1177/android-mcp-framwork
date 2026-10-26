import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { execCommand } from '../../utils/exec.js';
import { loadConfig } from '../../config/loader.js';
import type { ToolModule } from '../types.js';

export const toolName = 'android_cli_studio_find_symbol';
export const workflow = 'android-cli';

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Find Android Studio Symbol',
    description: 'Use Android Studio semantic analysis to find a symbol declaration or its usages. This is more accurate than text search when IDE indexing is available.',
    inputSchema: {
      symbol: z.string().min(1).max(300).describe('Class, method, variable, field, constant, or Android resource name.'),
      operation: z.enum(['declaration', 'usages']).describe('Whether to find the declaration or all usages.'),
      workingDirectory: z.string().optional().describe('Android project root; defaults to current directory.'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, withErrorHandling(async ({ symbol, operation, workingDirectory }) => {
    if (/[\r\n\0]/.test(symbol)) throw new Error('symbol must be a single-line name.');
    const subcommand = operation === 'declaration' ? 'find-declaration' : 'find-usages';
    const result = await execCommand(loadConfig().paths.androidCliPath, ['studio', subcommand, symbol], { cwd: workingDirectory, timeoutMs: 60_000 });
    const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n');
    if (result.exitCode !== 0) throw new Error(`Android Studio ${subcommand} failed (exit ${result.exitCode}): ${output}`);
    return textResult(output || `${subcommand} completed with no output.`, { operation, symbol, exitCode: result.exitCode, durationMs: result.durationMs });
  }));
}
const mod: ToolModule = { toolName, workflow, register };
export default mod;
