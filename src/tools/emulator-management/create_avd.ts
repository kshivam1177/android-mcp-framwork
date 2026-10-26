import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { execCommand } from '../../utils/exec.js';
import { findAvdmanager } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'create_avd';
export const workflow = 'emulator-management';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Create AVD',
      description:
        'Create a new Android Virtual Device. systemImage must already be installed via sdkmanager, e.g. "system-images;android-34;google_apis;arm64-v8a". Auto-answers the "custom hardware profile" prompt with no.',
      inputSchema: {
        name: z.string(),
        systemImage: z.string().describe('e.g. "system-images;android-34;google_apis;arm64-v8a"'),
        device: z.string().optional().describe('Device profile id, e.g. "pixel_8". Omit for avdmanager\'s default.'),
        force: z.boolean().optional().describe('Overwrite an existing AVD with the same name.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(async (args: { name: string; systemImage: string; device?: string; force?: boolean }) => {
      const cliArgs = ['create', 'avd', '-n', args.name, '-k', args.systemImage];
      if (args.device) cliArgs.push('-d', args.device);
      if (args.force) cliArgs.push('--force');
      const result = await execCommand(findAvdmanager(), cliArgs, { input: '\n', timeoutMs: 120_000 });
      if (result.exitCode !== 0) {
        return textResult(`create_avd failed:\n${result.stdout}\n${result.stderr}`);
      }
      return textResult(`Created AVD "${args.name}".`, { name: args.name });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
