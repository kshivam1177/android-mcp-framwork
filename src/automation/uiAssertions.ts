import type { UiNode } from '../types.js';

export type UiAssertionResult = {
  passed: boolean;
  mode: 'contains' | 'not_contains';
  expected: string;
  message: string;
};

/**
 * Verify a deterministic assertion against visible UI semantics.
 * Supported prefixes: "visible: text", "contains: text", "not_visible: text",
 * and "not_contains: text". Without a prefix, the expectation means "contains".
 * Matching is case-insensitive across text, content descriptions, and resource IDs.
 */
export function evaluateUiAssertion(nodes: UiNode[], expectation: string): UiAssertionResult {
  const trimmed = expectation.trim();
  const separator = trimmed.indexOf(':');
  const prefix = separator >= 0 ? trimmed.slice(0, separator).trim().toLowerCase() : '';
  const expected = (separator >= 0 && ['visible', 'contains', 'not_visible', 'not_contains'].includes(prefix)
    ? trimmed.slice(separator + 1)
    : trimmed).trim();
  if (!expected) {
    return { passed: false, mode: 'contains', expected, message: 'Assertion text must not be empty.' };
  }

  const supported = new Set(['visible', 'contains', 'not_visible', 'not_contains']);
  if (prefix && separator >= 0 && !supported.has(prefix)) {
    return { passed: false, mode: 'contains', expected, message: 'Unsupported assertion prefix "' + prefix + '". Use visible, contains, not_visible, or not_contains.' };
  }
  const haystack = nodes.flatMap(node => [node.text, node.contentDesc, node.resourceId])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n')
    .toLocaleLowerCase();
  const found = haystack.includes(expected.toLocaleLowerCase());
  const negative = prefix === 'not_visible' || prefix === 'not_contains';
  const passed = negative ? !found : found;
  const mode = negative ? 'not_contains' : 'contains';
  const message = passed
    ? 'Expected UI text ' + (negative ? 'was absent: ' : 'was present: ') + JSON.stringify(expected)
    : 'Expected UI text ' + (negative ? 'to be absent but it was present: ' : 'to be present but it was absent: ') + JSON.stringify(expected);
  return { passed, mode, expected, message };
}
