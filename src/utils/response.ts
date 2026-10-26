import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { AndroidBuildMcpError } from '../types.js';

export function textResult(text: string, structuredContent?: Record<string, unknown>): CallToolResult {
  return structuredContent !== undefined
    ? { content: [{ type: 'text', text }], structuredContent }
    : { content: [{ type: 'text', text }] };
}

/**
 * Every tool's catch block should funnel through this. Fails loudly with a
 * structured [CODE] prefix instead of silently swallowing or returning an
 * empty/ambiguous success - matches AndroidBuildMcpError's `code` so an agent
 * can branch on failure type without string-matching prose.
 */
export function errorResult(error: unknown): CallToolResult {
  if (error instanceof AndroidBuildMcpError) {
    const detailsText = error.details ? `\n\nDetails: ${JSON.stringify(error.details, null, 2)}` : '';
    return {
      isError: true,
      content: [{ type: 'text', text: `[${error.code}] ${error.message}${detailsText}` }],
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: 'text', text: `[UNEXPECTED_ERROR] ${message}` }] };
}

export function imageResult(base64Data: string, mimeType: string, text?: string): CallToolResult {
  const content: CallToolResult['content'] = [];
  if (text) content.push({ type: 'text', text });
  content.push({ type: 'image', data: base64Data, mimeType });
  return { content };
}

/** Wrap a tool handler body so every tool gets identical error handling
 * without repeating a try/catch in every single tool file. */
export function withErrorHandling<T extends unknown[]>(
  fn: (...args: T) => Promise<CallToolResult>
): (...args: T) => Promise<CallToolResult> {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (err) {
      return errorResult(err);
    }
  };
}
