import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { proposeSelectorRepair } from '../../testing-intelligence/selectorRepair.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import type { ToolModule } from '../types.js';

export const toolName = 'propose_selector_repairs';
export const workflow = 'testing-intelligence';

const nodeSchema = z.object({
  ref: z.string(), index: z.number(), className: z.string().optional(), text: z.string().optional(),
  contentDesc: z.string().optional(), resourceId: z.string().optional(), packageName: z.string().optional(),
  bounds: z.object({ left: z.number(), top: z.number(), right: z.number(), bottom: z.number() }),
  centerX: z.number(), centerY: z.number(), clickable: z.boolean(), enabled: z.boolean(),
  focusable: z.boolean(), scrollable: z.boolean(), checkable: z.boolean(), checked: z.boolean(), depth: z.number(),
});

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Propose UI Selector Repairs',
    description: 'Compare a stale selector with a caller-supplied current UI hierarchy and propose ranked alternatives. Never updates saved tests or executes actions.',
    inputSchema: {
      original: z.object({ kind: z.enum(['resourceId', 'contentDesc', 'text']), value: z.string().min(1).max(500) }),
      nodes: z.array(nodeSchema).max(5000),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, withErrorHandling(async (args: { original: { kind: 'resourceId' | 'contentDesc' | 'text'; value: string }; nodes: Array<z.infer<typeof nodeSchema>> }) => {
    const result = proposeSelectorRepair(args.original, args.nodes);
    return textResult(JSON.stringify(result, null, 2), result as unknown as Record<string, unknown>);
  }));
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
