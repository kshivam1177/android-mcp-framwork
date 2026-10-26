import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { imageResult, errorResult } from '../../utils/response.js';
import { resolveTargetAndBackend } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'screenshot';
export const workflow = 'ui-automation';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Screenshot',
      description: 'Capture a screenshot of the current screen. Image format depends on which automation backend served the request (adb -> PNG, uiautomator2 bridge -> JPEG) - check the response mimeType if it matters.',
      inputSchema: { targetId: z.string().optional() },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: { targetId?: string }) => {
      try {
        const { target, backend } = await resolveTargetAndBackend(args.targetId);
        const { data, mimeType } = await backend.screenshot(target.id);
        return imageResult(data.toString('base64'), mimeType, `Screenshot of ${target.id} (${mimeType}).`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
