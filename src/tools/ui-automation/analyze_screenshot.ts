import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { analyzeScreenshot } from '../../automation/screenshotAnalysis.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTargetAndBackend, dumpHierarchyWithRetry } from './_shared.js';
import { parseUiHierarchy } from '../../automation/uiHierarchy.js';
import { getScreenSize } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'analyze_screenshot';
export const workflow = 'ui-automation';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Analyze Screenshot',
      description: 'Prefer local Tesseract OCR on the current screenshot. If Tesseract is unavailable or fails, fall back to Android accessibility hierarchy text and bounds, so text inspection still works without OCR. Use snapshot_ui for semantic element refs.',
      inputSchema: {
        targetId: z.string().optional().describe('Target Android device ID; defaults to the active session target.'),
        language: z.string().regex(/^[a-zA-Z0-9_+-]+$/).optional().describe('Installed Tesseract language code (default: eng).'),
        minConfidence: z.number().int().min(0).max(100).optional().describe('Discard OCR words below this confidence (default: 35).'),
        mode: z.enum(['line', 'word']).optional().describe('Return grouped text lines (default) or individual words.'),
        timeoutMs: z.number().int().min(1000).max(120000).optional().describe('OCR timeout in milliseconds (default: 30000).'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: {
      targetId?: string; language?: string; minConfidence?: number;
      mode?: 'line' | 'word'; timeoutMs?: number;
    }) => {
      const { target, backend } = await resolveTargetAndBackend(args.targetId);
      const screenshot = await backend.screenshot(target.id);
      let analysis: Record<string, unknown>;
      let fallbackReason: string | undefined;
      try {
        analysis = await analyzeScreenshot(screenshot.data, {
          language: args.language, minConfidence: args.minConfidence,
          mode: args.mode, timeoutMs: args.timeoutMs,
        }) as unknown as Record<string, unknown>;
      } catch (error) {
        fallbackReason = error instanceof Error ? error.message : String(error);
        const xml = await dumpHierarchyWithRetry(backend, target.id);
        const screen = await getScreenSize(target.id);
        const nodes = parseUiHierarchy(xml).filter((node) =>
          Boolean(node.text || node.contentDesc) &&
          node.bounds.right > node.bounds.left && node.bounds.bottom > node.bounds.top
        );
        analysis = {
          engine: 'accessibility-hierarchy',
          language: 'device-accessibility',
          width: screen.width,
          height: screen.height,
          elements: nodes.map((node) => ({
            text: node.text ?? node.contentDesc ?? '',
            confidence: 100,
            bounds: node.bounds,
            center: { x: node.centerX, y: node.centerY },
            resourceId: node.resourceId,
            contentDesc: node.contentDesc,
          })),
        };
      }
      const result = {
        targetId: target.id, backend: backend.name, mimeType: screenshot.mimeType,
        coordinateSpace: 'device-screen-pixels',
        ...(fallbackReason ? { fallback: true, fallbackReason } : { fallback: false }),
        ...analysis,
      };
      return textResult(JSON.stringify(result, null, 2), result);
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
