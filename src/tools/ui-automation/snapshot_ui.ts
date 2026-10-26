import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { parseUiHierarchy, cacheSnapshot } from '../../automation/uiHierarchy.js';
import { resolveTargetAndBackend } from './_shared.js';
import type { ToolModule } from '../types.js';
import type { UiSnapshot } from '../../types.js';

export const toolName = 'snapshot_ui';
export const workflow = 'ui-automation';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Snapshot UI',
      description:
        'Capture a semantic UI hierarchy for the current screen - every element gets a short-lived elementRef (e1, e2, ...) that tap/long_press/type_text can target directly instead of guessing pixel coordinates. Refresh after navigation, scrolling, or any layout change - refs from a stale snapshot are rejected.',
      inputSchema: {
        targetId: z.string().optional(),
        interactiveOnly: z
          .boolean()
          .optional()
          .describe('Default true: only clickable/focusable/scrollable/checkable elements or ones with text/content-desc. false returns the full raw tree.'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(async (args: { targetId?: string; interactiveOnly?: boolean }) => {
      const { target, backend } = await resolveTargetAndBackend(args.targetId);
      const xml = await backend.dumpHierarchy(target.id);
      const allNodes = parseUiHierarchy(xml);
      const interactiveOnly = args.interactiveOnly !== false;
      const nodes = interactiveOnly
        ? allNodes.filter(
            (n) => n.clickable || n.focusable || n.scrollable || n.checkable || Boolean(n.text) || Boolean(n.contentDesc)
          )
        : allNodes;

      const snapshot: UiSnapshot = {
        targetId: target.id,
        capturedAt: new Date().toISOString(),
        backend: backend.name,
        nodes,
      };
      cacheSnapshot(snapshot);

      return textResult(JSON.stringify(snapshot, null, 2), {
        targetId: target.id,
        backend: backend.name,
        elementCount: nodes.length,
        totalElementCount: allNodes.length,
      });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
