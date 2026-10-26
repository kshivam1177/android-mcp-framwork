import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { runGradle, assembleTaskName } from '../../utils/gradle.js';
import { resolveBuildParams } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'build_device';
export const workflow = 'device';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Build (Device)',
      description:
        'Compile-only build for a Gradle module + variant (assemble<Variant>). Does not install or launch. Works identically whether you plan to target an emulator or a physical device - both use the same adb, unlike Xcode\'s simulator/device split.',
      inputSchema: {
        projectPath: z.string().optional().describe('Gradle project root. Falls back to sessionDefaults.projectPath.'),
        module: z.string().optional().describe('Gradle module path, e.g. ":app". Falls back to sessionDefaults.module.'),
        variant: z.string().optional().describe('Build variant, e.g. "debug" or "devDebug". Falls back to sessionDefaults.variant.'),
        extraArgs: z.array(z.string()).optional().describe('Extra raw Gradle CLI args, e.g. ["--stacktrace"].'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { projectPath?: string; module?: string; variant?: string; extraArgs?: string[] }) => {
      const { projectPath, module, variant } = resolveBuildParams(args);
      const task = assembleTaskName(module, variant);
      const result = await runGradle(projectPath, [task], { extraArgs: args.extraArgs });
      return textResult(`Built ${task} in ${projectPath}.\n\n${result.stdout.slice(-4000)}`, {
        task,
        exitCode: result.exitCode,
      });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
