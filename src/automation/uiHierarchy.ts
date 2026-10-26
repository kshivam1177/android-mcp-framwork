import type { UiElement } from './backend.js';

export function parseBounds(value: string): UiElement['bounds'] | undefined {
  const match = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(value);
  if (!match) return undefined;
  const [, left, top, right, bottom] = match;
  return { left: Number(left), top: Number(top), right: Number(right), bottom: Number(bottom) };
}

function attr(tag: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}="([^"]*)"`).exec(tag);
  return match?.[1]?.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

export function parseUiHierarchy(xml: string): UiElement[] {
  const elements: UiElement[] = [];
  for (const match of xml.matchAll(/<node\b[^>]*>/g)) {
    const tag = match[0];
    const bounds = parseBounds(attr(tag, 'bounds') ?? '');
    elements.push({
      text: attr(tag, 'text'), resourceId: attr(tag, 'resource-id'), className: attr(tag, 'class'),
      contentDescription: attr(tag, 'content-desc'), bounds,
      clickable: attr(tag, 'clickable') === 'true', enabled: attr(tag, 'enabled') !== 'false',
      focusable: attr(tag, 'focusable') === 'true', editable: /EditText|TextInputEditText/.test(attr(tag, 'class') ?? ''),
    });
  }
  return elements;
}
