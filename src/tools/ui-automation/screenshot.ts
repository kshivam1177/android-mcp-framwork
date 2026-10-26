import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { imageResult, errorResult } from '../../utils/response.js';
import { createArtifactPath, timestampedArtifactName } from '../../utils/artifacts.js';
import { resolveTargetAndBackend } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'screenshot';
export const workflow = 'ui-automation';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Screenshot',
      description:
        'Capture the current screen, return it as an image, and save a copy under .androidmcp-framework/artifacts/screenshots/ by default.',
      inputSchema: {
        targetId: z.string().optional(),
        projectPath: z.string().optional().describe('Project root for the saved screenshot; defaults to the current working directory.'),
        outputPath: z.string().optional().describe('Optional explicit screenshot file path. Defaults to the project artifacts folder.'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: { targetId?: string; projectPath?: string; outputPath?: string }) => {
      try {
        const { target, backend } = await resolveTargetAndBackend(args.targetId);
        const { data, mimeType } = await backend.screenshot(target.id);
        const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
        const outputPath = args.outputPath
          ? path.resolve(args.outputPath)
          : createArtifactPath(
              args.projectPath ?? process.cwd(),
              'screenshots',
              timestampedArtifactName(target.id, extension)
            );
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, data);
        return imageResult(
          data.toString('base64'),
          mimeType,
          `Screenshot of ${target.id} (${mimeType}) saved to ${outputPath}.`
        );
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
