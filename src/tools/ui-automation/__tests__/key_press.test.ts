import { describe, expect, it } from 'vitest';
import { normalizeKeyCode } from '../key_press.js';

describe('normalizeKeyCode', () => {
  it('accepts Android symbolic names and friendly aliases', () => {
    expect(normalizeKeyCode('KEYCODE_BACK')).toBe('KEYCODE_BACK');
    expect(normalizeKeyCode('BACK')).toBe('KEYCODE_BACK');
    expect(normalizeKeyCode('enter')).toBe('KEYCODE_ENTER');
  });

  it('accepts integer and numeric-string key codes', () => {
    expect(normalizeKeyCode(4)).toBe('4');
    expect(normalizeKeyCode('111')).toBe('111');
  });

  it('rejects empty names', () => {
    expect(() => normalizeKeyCode('  ')).toThrow(/must not be empty/);
  });
});
