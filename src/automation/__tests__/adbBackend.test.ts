import { describe, it, expect } from 'vitest';
import { escapeAdbInputText } from '../adbBackend.js';

describe('escapeAdbInputText', () => {
  it('replaces spaces with the %s sequence input text expects', () => {
    expect(escapeAdbInputText('hello world')).toBe('hello%sworld');
  });

  it('escapes shell metacharacters that adb\'s remote-shell relay could re-tokenize on', () => {
    expect(escapeAdbInputText('a&b')).toBe('a\\&b');
    expect(escapeAdbInputText('a;b')).toBe('a\\;b');
    expect(escapeAdbInputText("a'b")).toBe("a\\'b");
  });

  it('escapes backslashes before anything else so they round-trip literally', () => {
    expect(escapeAdbInputText('C:\\path')).toBe('C:\\\\path');
  });

  it('leaves plain alphanumeric text untouched', () => {
    expect(escapeAdbInputText('hello123')).toBe('hello123');
  });
});
