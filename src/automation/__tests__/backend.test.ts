import { describe, it, expect } from 'vitest';
import { resolveBackend } from '../index.js';
import { adbBackend } from '../adbBackend.js';

describe('resolveBackend', () => {
  it('always selects the zero-setup ADB backend', async () => {
    await expect(resolveBackend('emulator-5554')).resolves.toBe(adbBackend);
  });
});
