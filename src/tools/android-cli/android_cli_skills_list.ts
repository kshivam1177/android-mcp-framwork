import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { execCommand } from '../../utils/exec.js';
import { loadConfig } from '../../config/loader.js';
import type { ToolModule } from '../types.js';

export const toolName = 'android_cli_skills_list';
export const workflow = 'android-cli';

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'List Android CLI Skills',
    description: 'List Android CLI skills available or installed in the current environment. Skills provide curated Android implementation and testing guidance to coding agents.',
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, withErrorHandling(async () => {
    const result = await execCommand(loadConfig().paths.androidCliPath, ['skills', 'list'], { timeoutMs: 45_000 });
    const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n');
    if (result.exitCode !== 0) throw new Error(`android skills list failed (exit ${result.exitCode}): ${output}`);
    return textResult(output || 'No Android CLI skills were reported.', { exitCode: result.exitCode, durationMs: result.durationMs });
  }));
}
const mod: ToolModule = { toolName, workflow, register };
export default mod;
