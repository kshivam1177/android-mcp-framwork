import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { runGradle } from '../../utils/gradle.js';
import type { ToolModule } from '../types.js';

export const toolName = 'gradle_module_build';
export const workflow = 'gradle-module';

function modulePrefix(module: string): string {
  const trimmed = module.trim();
  return trimmed === '' || trimmed === ':' ? '' : trimmed.endsWith(':') ? trimmed : `${trimmed}:`;
}

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Build Gradle Module',
      description:
        'Build a standalone Gradle module (a pure-JVM/Kotlin library, not necessarily an Android app module) - the rough analogue of building a Swift Package target. Runs <module>:build, or <module>:assemble<Variant> if variant is given for an Android library module.',
      inputSchema: {
        projectPath: z.string(),
        module: z.string(),
        variant: z.string().optional(),
        extraArgs: z.array(z.string()).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { projectPath: string; module: string; variant?: string; extraArgs?: string[] }) => {
      const task = args.variant
        ? `${modulePrefix(args.module)}assemble${args.variant.charAt(0).toUpperCase()}${args.variant.slice(1)}`
        : `${modulePrefix(args.module)}build`;
      const result = await runGradle(args.projectPath, [task], { extraArgs: args.extraArgs, timeoutMs: 600_000 });
      return textResult(`Ran ${task}.\n\n${result.stdout.slice(-4000)}`, { task });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
