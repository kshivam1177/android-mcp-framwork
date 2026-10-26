import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { runGradle, installTaskName } from '../../utils/gradle.js';
import { resolveTarget, runAdbShell } from '../../utils/adb.js';
import { inspectApk, findBuiltApk, moduleDirFromPath } from '../../utils/apk.js';
import { resolveBuildParams } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'build_run_device';
export const workflow = 'device';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Build, Install, and Launch',
      description:
        'One-shot: build a module + variant, install it, and launch it. Resolves the target automatically - an explicit targetId wins, then the active session default, then whichever single emulator/device is connected; if more than one is connected without a pin, this fails with the candidate list instead of guessing. Launches via the default launcher activity unless `activity` is given.',
      inputSchema: {
        projectPath: z.string().optional(),
        module: z.string().optional(),
        variant: z.string().optional(),
        targetId: z.string().optional().describe('adb serial. Auto-resolved if omitted.'),
        activity: z.string().optional().describe('Fully-qualified activity to launch, e.g. "com.example.app.MainActivity". Defaults to the app\'s launcher activity.'),
        extraArgs: z.array(z.string()).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(
      async (args: { projectPath?: string; module?: string; variant?: string; targetId?: string; activity?: string; extraArgs?: string[] }) => {
        const { projectPath, module, variant } = resolveBuildParams(args);
        const target = await resolveTarget({ requestedId: args.targetId });

        const task = installTaskName(module, variant);
        await runGradle(projectPath, [task], {
          extraArgs: args.extraArgs,
          timeoutMs: 900_000,
        });

        const moduleDir = moduleDirFromPath(projectPath, module);
        const apkPath = findBuiltApk(moduleDir, variant);
        const info = await inspectApk(apkPath);

        if (args.activity) {
          await runAdbShell(target.id, ['am', 'start', '-n', `${info.packageName}/${args.activity}`]);
        } else {
          await runAdbShell(target.id, ['monkey', '-p', info.packageName, '-c', 'android.intent.category.LAUNCHER', '1']);
        }

        return textResult(
          `Built, installed, and launched ${info.packageName} (${variant}) on ${target.id}.`,
          { target, apkPath, packageName: info.packageName, launchedActivity: args.activity ?? info.launchableActivity }
        );
      }
    )
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
