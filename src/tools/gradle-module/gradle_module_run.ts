import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveGradleCommand, assertGradleProject } from '../../utils/gradle.js';
import { startBackgroundProcess } from '../../utils/processRegistry.js';
import type { ToolModule } from '../types.js';

export const toolName = 'gradle_module_run';
export const workflow = 'gradle-module';

function modulePrefix(module: string): string {
  const trimmed = module.trim();
  return trimmed === '' || trimmed === ':' ? '' : trimmed.endsWith(':') ? trimmed : `${trimmed}:`;
}

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Run Gradle Module',
      description:
        'Run <module>:run in the background - only works if the module applies the Gradle `application` plugin with a configured mainClass (a pure-JVM/Kotlin module, not an Android app module, which has no standalone entry point). Returns a processId; use gradle_module_stop to end it.',
      inputSchema: { projectPath: z.string(), module: z.string(), args: z.array(z.string()).optional() },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(async (args: { projectPath: string; module: string; args?: string[] }) => {
      assertGradleProject(args.projectPath);
      const { command, args: baseArgs } = resolveGradleCommand(args.projectPath);
      const task = `${modulePrefix(args.module)}run`;
      const gradleArgs = [...baseArgs, task, '--console=plain'];
      if (args.args && args.args.length > 0) {
        gradleArgs.push('--args', args.args.join(' '));
      }
      const tracked = startBackgroundProcess(command, gradleArgs, {
        targetId: args.module,
        kind: 'gradle-run',
        cwd: args.projectPath,
      });
      return textResult(`Started ${task} in the background.`, { processId: tracked.id, logFilePath: tracked.logFilePath });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
