import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { runGradle, connectedTestTaskName, unitTestTaskName } from '../../utils/gradle.js';
import { resolveTarget } from '../../utils/adb.js';
import { resolveBuildParams } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'test_device';
export const workflow = 'device';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Test (Device)',
      description:
        'Run tests for a module + variant. `instrumented` (default) runs connected<Variant>AndroidTest against the resolved target via ANDROID_SERIAL - needs an emulator or device attached. `unit` runs test<Variant>UnitTest on the JVM instead and needs no target at all.',
      inputSchema: {
        projectPath: z.string().optional(),
        module: z.string().optional(),
        variant: z.string().optional(),
        targetId: z.string().optional(),
        kind: z.enum(['instrumented', 'unit']).optional().describe('Defaults to "instrumented".'),
        extraArgs: z.array(z.string()).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(
      async (args: { projectPath?: string; module?: string; variant?: string; targetId?: string; kind?: 'instrumented' | 'unit'; extraArgs?: string[] }) => {
        const { projectPath, module, variant } = resolveBuildParams(args);
        const kind = args.kind ?? 'instrumented';

        if (kind === 'unit') {
          const task = unitTestTaskName(module, variant);
          const result = await runGradle(projectPath, [task], { extraArgs: args.extraArgs, timeoutMs: 900_000 });
          return textResult(`Ran ${task}.\n\n${result.stdout.slice(-4000)}`, { task, kind });
        }

        const target = await resolveTarget({ requestedId: args.targetId });
        const task = connectedTestTaskName(module, variant);
        const result = await runGradle(projectPath, [task], {
          extraArgs: args.extraArgs,
          timeoutMs: 1_800_000,
          env: { ANDROID_SERIAL: target.id },
        });
        return textResult(`Ran ${task} on ${target.id}.\n\n${result.stdout.slice(-4000)}`, { task, kind, target });
      }
    )
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
