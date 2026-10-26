import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { runGradle } from '../../utils/gradle.js';
import type { ToolModule } from '../types.js';

export const toolName = 'gradle_module_test';
export const workflow = 'gradle-module';

function modulePrefix(module: string): string {
  const trimmed = module.trim();
  return trimmed === '' || trimmed === ':' ? '' : trimmed.endsWith(':') ? trimmed : `${trimmed}:`;
}

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Test Gradle Module',
      description: 'Run <module>:test for a standalone Gradle module (JVM unit tests, no emulator/device needed).',
      inputSchema: { projectPath: z.string(), module: z.string(), extraArgs: z.array(z.string()).optional() },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(async (args: { projectPath: string; module: string; extraArgs?: string[] }) => {
      const task = `${modulePrefix(args.module)}test`;
      const result = await runGradle(args.projectPath, [task], { extraArgs: args.extraArgs, timeoutMs: 600_000 });
      return textResult(`Ran ${task}.\n\n${result.stdout.slice(-4000)}`, { task });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
