import { z } from 'zod';
import { AdbBackend } from '../../automation/adbBackend.js';
import type { UiElement } from '../../automation/backend.js';
import { jsonResponse } from '../../utils/response.js';

const FieldSchema = z.object({
  selector: z.object({ text: z.string().optional(), resourceId: z.string().optional(), contentDescription: z.string().optional(), className: z.string().optional() }),
  value: z.string(),
}).strict();
const InputSchema = z.object({
  deviceSerial: z.string().optional(),
  fields: z.array(FieldSchema).min(1).max(40),
  submit: z.object({ text: z.string().optional(), resourceId: z.string().optional(), contentDescription: z.string().optional() }).optional(),
  pressDone: z.boolean().default(false),
}).strict();

function matches(element: UiElement, selector: z.infer<typeof FieldSchema>['selector']): boolean {
  const entries = Object.entries(selector).filter(([, value]) => value !== undefined);
  return entries.length > 0 && entries.every(([key, value]) => element[key as keyof UiElement] === value);
}

function center(element: UiElement): { x: number; y: number } | undefined {
  const b = element.bounds;
  return b ? { x: Math.round((b.left + b.right) / 2), y: Math.round((b.top + b.bottom) / 2) } : undefined;
}

export async function fillFormTool(input: unknown) {
  const args = InputSchema.parse(input);
  const backend = new AdbBackend();
  let snapshot = await backend.snapshot(args.deviceSerial);
  const outcomes: Array<{ selector: unknown; status: string; message?: string }> = [];

  for (const field of args.fields) {
    let candidates = snapshot.elements.filter(element => matches(element, field.selector) && element.enabled !== false && (element.editable || /EditText|TextInput/.test(element.className ?? '')));
    if (candidates.length !== 1) {
      outcomes.push({ selector: field.selector, status: 'blocked', message: candidates.length ? 'Selector is ambiguous' : 'No editable element matched; refresh the UI hierarchy or use a more precise selector' });
      return jsonResponse({ success: false, outcomes, completedFields: outcomes.filter(o => o.status === 'filled').length });
    }
    const position = center(candidates[0]!);
    if (!position) {
      outcomes.push({ selector: field.selector, status: 'blocked', message: 'The element has no usable bounds' });
      return jsonResponse({ success: false, outcomes });
    }
    await backend.tap(position.x, position.y, args.deviceSerial);
    await backend.pressKey('CTRL+A', args.deviceSerial).catch(() => undefined);
    await backend.typeText(field.value, args.deviceSerial);
    outcomes.push({ selector: field.selector, status: 'filled' });
    // Re-read hierarchy after the focus change because the keyboard may resize or scroll the form.
    snapshot = await backend.snapshot(args.deviceSerial);
  }

  if (args.pressDone) await backend.pressKey('DONE', args.deviceSerial);
  if (args.submit) {
    const latest = await backend.snapshot(args.deviceSerial);
    const candidates = latest.elements.filter(element => matches(element, args.submit!) && element.enabled !== false && element.clickable !== false);
    if (candidates.length !== 1) return jsonResponse({ success: false, outcomes, submit: { status: 'blocked', message: candidates.length ? 'Submit selector is ambiguous' : 'Submit control was not found' } });
    const position = center(candidates[0]!);
    if (!position) return jsonResponse({ success: false, outcomes, submit: { status: 'blocked', message: 'Submit control has no usable bounds' } });
    await backend.tap(position.x, position.y, args.deviceSerial);
    return jsonResponse({ success: true, outcomes, submit: { status: 'action-issued', message: 'Submit tap issued; verify the resulting application state separately' } });
  }
  return jsonResponse({ success: true, outcomes, message: 'Input actions issued; verify values and application state separately' });
}
