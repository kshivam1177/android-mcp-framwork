import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { analyzeScreenshot } from '../../automation/screenshotAnalysis.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveTargetAndBackend } from './_shared.js';
import type { ToolModule } from '../types.js';

export const toolName = 'analyze_screenshot';
export const workflow = 'ui-automation';

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Analyze Screenshot',
      description: 'Run local OCR on the current Android screenshot and return visible text with bounding boxes and center coordinates in screenshot pixels as JSON. Requires Tesseract OCR installed locally. OCR detects text, not every icon or non-text control; use snapshot_ui for semantic Android element bounds.',
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
      const analysis = await analyzeScreenshot(screenshot.data, {
        language: args.language, minConfidence: args.minConfidence,
        mode: args.mode, timeoutMs: args.timeoutMs,
      });
      const result = {
        targetId: target.id, backend: backend.name, mimeType: screenshot.mimeType,
        coordinateSpace: 'screenshot-pixels', ...analysis,
      };
      return textResult(JSON.stringify(result, null, 2), result);
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
