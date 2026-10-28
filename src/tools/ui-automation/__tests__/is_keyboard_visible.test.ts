import { describe, expect, it } from 'vitest';
import { parseKeyboardVisibility } from '../is_keyboard_visible.js';
describe('parseKeyboardVisibility', () => {
  it('parses common InputMethodManager visibility fields', () => {
    expect(parseKeyboardVisibility('mInputShown=true')).toBe(true);
    expect(parseKeyboardVisibility('mIsInputViewShown = false')).toBe(false);
  });
  it('returns null when the device output is not recognizable', () => {
    expect(parseKeyboardVisibility('Input method state unavailable')).toBeNull();
  });
});
