import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { runGradle } from '../../utils/gradle.js';
import type { ToolModule } from '../types.js';

export const toolName = 'list_variants';
export const workflow = 'project-discovery';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'List Variants',
      description:
        'List build variants actually configured for a module, by asking Gradle itself (gradlew :module:tasks --all and reading off every generated assemble<Variant> task) rather than parsing build.gradle DSL - accurate regardless of how flavors/build types were declared, version catalogs, or convention plugins.',
      inputSchema: { projectPath: z.string(), module: z.string() },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { projectPath: string; module: string }) => {
      const modulePrefix = args.module === ':' || args.module === '' ? '' : `${args.module}:`;
      const result = await runGradle(args.projectPath, [`${modulePrefix}tasks`], {
        extraArgs: ['--all'],
        timeoutMs: 120_000,
      });
      const variants = Array.from(
        new Set(
          Array.from(result.stdout.matchAll(/^assemble([A-Z]\w*)\s/gm)).map((m) => {
            const name = m[1] as string;
            return name.charAt(0).toLowerCase() + name.slice(1);
          })
        )
      ).filter((v) => v.toLowerCase() !== 'release' || true); // keep all; no special-casing needed
      return textResult(variants.length > 0 ? variants.join('\n') : '(no assemble<Variant> tasks found - is this an Android module?)', { variants });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
