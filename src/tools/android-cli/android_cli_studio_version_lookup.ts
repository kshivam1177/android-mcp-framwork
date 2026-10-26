import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { execCommand } from '../../utils/exec.js';
import { loadConfig } from '../../config/loader.js';
import type { ToolModule } from '../types.js';

export const toolName = 'android_cli_studio_version_lookup';
export const workflow = 'android-cli';

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Look Up Android Dependency Versions',
    description: 'Ask Android Studio via Android CLI for current versions of Maven artifacts, Android versions, or SDK tools. Prefer this over hard-coding a guessed latest version.',
    inputSchema: {
      query: z.string().min(1).max(300).describe('Artifact or version lookup query accepted by android studio version-lookup.'),
      workingDirectory: z.string().optional().describe('Android project root; defaults to current directory.'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, withErrorHandling(async ({ query, workingDirectory }) => {
    if (/[\r\n\0]/.test(query)) throw new Error('query must be a single line.');
    const result = await execCommand(loadConfig().paths.androidCliPath, ['studio', 'version-lookup', ...query.trim().split(/\s+/)], { cwd: workingDirectory, timeoutMs: 60_000 });
    const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n');
    if (result.exitCode !== 0) throw new Error(`Android Studio version lookup failed (exit ${result.exitCode}): ${output}`);
    return textResult(output || 'Version lookup completed with no output.', { query, exitCode: result.exitCode, durationMs: result.durationMs });
  }));
}
const mod: ToolModule = { toolName, workflow, register };
export default mod;
