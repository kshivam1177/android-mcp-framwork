import { describe, expect, it } from 'vitest';
import { parseBounds, parseUiHierarchy } from '../../../automation/uiHierarchy.js';

describe('fast form UI map primitives', () => {
  it('parses Android bounds into a rectangle', () => {
    expect(parseBounds('[10,20][110,70]')).toEqual({ left: 10, top: 20, right: 110, bottom: 70 });
  });
  it('returns undefined for invalid bounds', () => {
    expect(parseBounds('unknown')).toBeUndefined();
  });
  it('parses input and button metadata from UI hierarchy XML', () => {
    const xml = '<hierarchy><node text="Email" resource-id="app:id/email" class="android.widget.EditText" enabled="true" clickable="true" bounds="[10,20][110,70]"/><node text="Submit" resource-id="app:id/submit" class="android.widget.Button" enabled="true" clickable="true" bounds="[10,100][110,150]"/></hierarchy>';
    const elements = parseUiHierarchy(xml);
    expect(elements).toHaveLength(2);
    expect(elements[0]?.editable).toBe(true);
    expect(elements[0]?.bounds).toEqual({ left: 10, top: 20, right: 110, bottom: 70 });
    expect(elements[1]?.text).toBe('Submit');
  });
});
