import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { parseUiHierarchy, cacheSnapshot } from '../../automation/uiHierarchy.js';
import { auditScreen } from '../../automation/qaAuditor.js';
import { resolveTargetAndBackend, getScreenSize } from '../ui-automation/_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'audit_screen';
export const workflow = 'testing-intelligence';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Audit Screen QA',
      description:
        'Perform an effortless, comprehensive QA audit on the active screen: checks for UI responsiveness errors, RenderFlex overflows, layout overlap, truncated text, broken/placeholder data (null, undefined, NaN), and logcat exceptions.',
      inputSchema: {
        targetId: z.string().optional().describe('Target Android device ID; defaults to active session default.'),
        checkLogs: z.boolean().optional().describe('Whether to inspect recent logcat for exceptions/errors (default true).'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(async (args: { targetId?: string; checkLogs?: boolean }) => {
      const { target, backend } = await resolveTargetAndBackend(args.targetId);
      const xml = await backend.dumpHierarchy(target.id);
      const nodes = parseUiHierarchy(xml);

      cacheSnapshot({
        targetId: target.id,
        capturedAt: new Date().toISOString(),
        backend: backend.name,
        nodes,
      });

      let screenSize = { width: 720, height: 1280 };
      try {
        screenSize = await getScreenSize(target.id);
      } catch {
        // use fallback if getScreenSize fails
      }

      const auditResult = await auditScreen({
        targetId: target.id,
        nodes,
        screenDimensions: screenSize,
        checkLogs: args.checkLogs !== false,
      });

      return textResult(auditResult.summary, {
        targetId: target.id,
        healthStatus: auditResult.healthStatus,
        metrics: auditResult.metrics,
        issues: auditResult.issues,
        elementCount: auditResult.elementCount,
      });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;

