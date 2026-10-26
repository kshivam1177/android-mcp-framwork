import type { UiNode } from '../types.js';

export interface UiSelector {
  resourceId?: string;
  contentDesc?: string;
  textContains?: string;
}
export type UiNodeRole = 'field' | 'button';

export function matchesUiSelector(node: UiNode, selector: UiSelector): boolean {
  if (selector.resourceId && node.resourceId !== selector.resourceId) return false;
  if (selector.contentDesc && node.contentDesc !== selector.contentDesc) return false;
  if (selector.textContains && !(node.text ?? '').toLowerCase().includes(selector.textContains.toLowerCase())) return false;
  return Boolean(selector.resourceId || selector.contentDesc || selector.textContains);
}

/** Resolve exactly one visible, enabled node; ambiguous selectors fail closed. */
export function resolveUniqueUiNode(nodes: UiNode[], selector: UiSelector, label: string, role: UiNodeRole = 'button'): UiNode {
  const found = nodes.filter((node) => {
    const bounds = node.bounds;
    const hasBounds = bounds.right > bounds.left && bounds.bottom > bounds.top;
    const className = node.className ?? '';
    const fieldClass = /EditText|TextInputEditText|AutoCompleteTextView|TextField/i.test(className);
    const nonFieldClass = /Button|TextView|ImageView|Switch|CheckBox|RadioButton/i.test(className);
    const roleMatches = role === 'field'
      ? fieldClass || (node.focusable && !nonFieldClass)
      : node.clickable || node.focusable;
    return hasBounds && node.enabled && roleMatches && matchesUiSelector(node, selector);
  });
  if (found.length !== 1) {
    throw new Error(found.length === 0
      ? `Could not find an enabled UI element for ${label}.`
      : `Selector for ${label} matched ${found.length} elements; use a more specific selector.`);
  }
  return found[0]!;
}
