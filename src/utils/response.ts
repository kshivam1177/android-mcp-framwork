export function jsonResponse<T>(value: T) { return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }], structuredContent: value }; }
