import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTarget, runAdbForTarget } from '../../utils/adb.js';
import { findBuiltApk, moduleDirFromPath } from '../../utils/apk.js';
import { resolveBuildParams } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'install_app_device';
export const workflow = 'device';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Install App',
      description:
        'Install an already-built APK for a module + variant onto the resolved target. Does not rebuild - run build_device first if sources changed. Pass apkPath directly to skip variant lookup entirely.',
      inputSchema: {
        projectPath: z.string().optional(),
        module: z.string().optional(),
        variant: z.string().optional(),
        apkPath: z.string().optional().describe('Explicit path to a .apk, bypassing module/variant lookup.'),
        targetId: z.string().optional(),
        reinstall: z.boolean().optional().describe('Pass -r to adb install to keep existing app data. Default true.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(
      async (args: { projectPath?: string; module?: string; variant?: string; apkPath?: string; targetId?: string; reinstall?: boolean }) => {
        const target = await resolveTarget({ requestedId: args.targetId });
        let apkPath = args.apkPath;
        if (!apkPath) {
          const { projectPath, module, variant } = resolveBuildParams(args);
          apkPath = findBuiltApk(moduleDirFromPath(projectPath, module), variant);
        }
        const flags = args.reinstall === false ? [] : ['-r'];
        const result = await runAdbForTarget(target.id, ['install', ...flags, apkPath], { timeoutMs: 180_000 });
        return textResult(`Installed ${apkPath} on ${target.id}.\n\n${result.stdout}`, { target, apkPath });
      }
    )
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
