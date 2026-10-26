import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { runGradle } from '../../utils/gradle.js';
import type { ToolModule } from '../types.js';

export const toolName = 'gradle_module_list';
export const workflow = 'gradle-module';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'List Gradle Modules',
      description: "List every subproject in the build (gradlew projects) - broader than list_modules' settings.gradle text parse, since it reflects Gradle's actual resolved project graph.",
      inputSchema: { projectPath: z.string() },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { projectPath: string }) => {
      const result = await runGradle(args.projectPath, ['projects'], { timeoutMs: 120_000 });
      const modules = Array.from(result.stdout.matchAll(/Project '(:[^']*)'/g)).map((m) => m[1] as string);
      return textResult(modules.length > 0 ? modules.join('\n') : result.stdout, { modules });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
