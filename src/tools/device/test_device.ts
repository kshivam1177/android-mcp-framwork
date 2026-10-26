import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { runGradle, connectedTestTaskName, unitTestTaskName } from '../../utils/gradle.js';
import { resolveTarget } from '../../utils/adb.js';
import { execCommand } from '../../utils/exec.js';
import { getEffectiveSessionDefaults } from '../../session/defaults.js';
import { findFlutterProjectRoot, discoverWorkspaceProjects } from '../../utils/projectDiscovery.js';
import { resolveBuildParams } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'test_device';
export const workflow = 'device';

function resolveFlutterTestRoot(requestedPath: string): { root?: string; candidates: string[] } {
  const requested = path.resolve(requestedPath);
  if (fs.existsSync(path.join(requested, 'pubspec.yaml'))) return { root: requested, candidates: [requested] };
  const nearest = findFlutterProjectRoot(requested);
  if (nearest) return { root: nearest, candidates: [nearest] };
  const discovery = discoverWorkspaceProjects(requested);
  const candidates = discovery.flutterProjects
    .filter((project) => project.hasUnitTests || project.hasIntegrationTests || project.hasAndroidHost)
    .map((project) => project.projectRoot);
  return { root: candidates.length === 1 ? candidates[0] : undefined, candidates };
}

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Test (Device)',
      description:
        'Run Native Android Gradle tests or Flutter tests. Native unit runs test<Variant>UnitTest and instrumented runs connected<Variant>AndroidTest. Flutter unit runs flutter test (unit + widget tests); Flutter instrumented runs flutter test -d <device-id> integration_test when integration_test/ exists.',
      inputSchema: {
        projectPath: z.string().optional().describe('Gradle root or Flutter package root; Flutter monorepos should pass the package path explicitly if multiple apps exist.'),
        module: z.string().optional(),
        variant: z.string().optional(),
        targetId: z.string().optional(),
        kind: z.enum(['instrumented', 'unit']).optional().describe('Defaults to instrumented for native Android; unit runs Flutter unit/widget tests without a device.'),
        extraArgs: z.array(z.string()).optional().describe('Additional arguments passed to Gradle or flutter test.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(
      async (args: { projectPath?: string; module?: string; variant?: string; targetId?: string; kind?: 'instrumented' | 'unit'; extraArgs?: string[] }) => {
        const defaults = getEffectiveSessionDefaults().defaults;
        const requestedPath = args.projectPath ?? defaults.projectPath ?? process.cwd();
        const flutter = resolveFlutterTestRoot(requestedPath);

        if (flutter.root) {
          const flutterRoot = flutter.root;
          const kind = args.kind ?? 'instrumented';
          const flutterCommand = process.env.FLUTTER_PATH || 'flutter';
          if (kind === 'unit') {
            const result = await execCommand(flutterCommand, ['test', ...(args.extraArgs ?? [])], {
              cwd: flutterRoot,
              timeoutMs: 900_000,
            });
            if (result.exitCode !== 0) {
              throw new Error('Flutter unit/widget tests failed (exit ' + result.exitCode + ') in ' + flutterRoot + '.\n' + (result.stderr || result.stdout).slice(-5000));
            }
            return textResult('Ran flutter test in ' + flutterRoot + '.\n\n' + result.stdout.slice(-5000), {
              runner: 'flutter',
              kind: 'unit',
              projectPath: flutterRoot,
              command: result.command,
              durationMs: result.durationMs,
            });
          }

          if (!fs.existsSync(path.join(flutterRoot, 'integration_test'))) {
            throw new Error(
              'Flutter project detected at ' + flutterRoot + ', but no integration_test/ directory exists. ' +
              'Run unit/widget tests with test_device kind="unit" (flutter test), or add integration_test/ and rerun kind="instrumented" to execute on a device.'
            );
          }
          const target = await resolveTarget({ requestedId: args.targetId });
          const result = await execCommand(
            flutterCommand,
            ['test', '-d', target.id, 'integration_test', ...(args.extraArgs ?? [])],
            { cwd: flutterRoot, timeoutMs: 1_800_000 }
          );
          if (result.exitCode !== 0) {
            throw new Error('Flutter integration tests failed (exit ' + result.exitCode + ') on ' + target.id + '.\n' + (result.stderr || result.stdout).slice(-5000));
          }
          return textResult('Ran Flutter integration tests on ' + target.id + '.\n\n' + result.stdout.slice(-5000), {
            runner: 'flutter',
            kind: 'instrumented',
            projectPath: flutterRoot,
            target,
            command: result.command,
            durationMs: result.durationMs,
          });
        }

        if (flutter.candidates.length > 1) {
          throw new Error('Multiple Flutter packages were found in the workspace: ' + flutter.candidates.join(', ') + '. Pass projectPath for the package you want to test.');
        }

        const { projectPath, module, variant } = resolveBuildParams(args);
        const kind = args.kind ?? 'instrumented';
        if (kind === 'unit') {
          const task = unitTestTaskName(module, variant);
          const result = await runGradle(projectPath, [task], { extraArgs: args.extraArgs, timeoutMs: 900_000 });
          return textResult('Ran ' + task + '.\n\n' + result.stdout.slice(-4000), { task, kind, runner: 'gradle' });
        }

        const target = await resolveTarget({ requestedId: args.targetId });
        const task = connectedTestTaskName(module, variant);
        const result = await runGradle(projectPath, [task], {
          extraArgs: args.extraArgs,
          timeoutMs: 1_800_000,
          env: { ANDROID_SERIAL: target.id },
        });
        return textResult('Ran ' + task + ' on ' + target.id + '.\n\n' + result.stdout.slice(-4000), { task, kind, target, runner: 'gradle' });
      }
    )
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
