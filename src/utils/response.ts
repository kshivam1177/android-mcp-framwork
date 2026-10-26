export interface ToolResponse<T = unknown> {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: T;
  isError?: boolean;
}

export function textResponse(text: string): ToolResponse {
  return { content: [{ type: 'text', text }] };
}

export function jsonResponse<T>(value: T): ToolResponse<T> {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], structuredContent: value };
}

export function errorResponse(error: unknown): ToolResponse {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}
