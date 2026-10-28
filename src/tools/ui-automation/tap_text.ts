import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTargetAndBackend, dumpHierarchyWithRetry, resolveTextNode } from './_shared.js';
import type { ToolModule } from '../types.js';
export const toolName = 'tap_text';
export const workflow = 'ui-automation';
export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Tap Text',
    description: 'Resolve visible text/content description from Android accessibility hierarchy and tap its bounds center. Does not require OCR. Ambiguous matches fail safely.',
    inputSchema: { text: z.string().min(1), exact: z.boolean().optional().default(false), targetId: z.string().optional() },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, withErrorHandling(async (args: { text: string; exact?: boolean; targetId?: string }) => {
    const { target, backend } = await resolveTargetAndBackend(args.targetId);
    const xml = await dumpHierarchyWithRetry(backend, target.id);
    const node = resolveTextNode(xml, args.text, args.exact === true);
    await backend.tap(target.id, node.centerX, node.centerY);
    return textResult('Tapped text "' + args.text + '" on ' + target.id + '.', { targetId: target.id, text: args.text, matchedText: node.text, contentDesc: node.contentDesc, resourceId: node.resourceId, x: node.centerX, y: node.centerY, bounds: node.bounds, resolution: 'accessibility-hierarchy' });
  }));
}
const mod: ToolModule = { toolName, workflow, register };
export default mod;
