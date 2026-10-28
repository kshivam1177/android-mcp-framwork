import { describe, expect, it, vi } from 'vitest';
import { dumpHierarchyWithRetry, resolveTextNode } from '../_shared.js';
import type { AutomationBackend } from '../../../automation/backend.js';

const XML = '<hierarchy><node index="0" text="Login" resource-id="app:id/login" class="android.widget.Button" package="app" content-desc="" clickable="true" enabled="true" focusable="true" scrollable="false" checkable="false" checked="false" bounds="[0,0][100,50]"></node></hierarchy>';
const backend = (dumpHierarchy: ReturnType<typeof vi.fn>) => ({ name: 'adb', dumpHierarchy } as unknown as AutomationBackend);

describe('accessibility text resolution', () => {
  it('matches text case-insensitively and returns the bounds center', () => {
    const node = resolveTextNode(XML, 'log', false);
    expect(node.text).toBe('Login');
    expect(node.centerX).toBe(50);
    expect(node.centerY).toBe(25);
  });
  it('supports exact matching and rejects ambiguous results', () => {
    expect(() => resolveTextNode(XML, 'log', true)).toThrow(/No enabled accessibility element/);
    const duplicate = XML.replace('</hierarchy>', '<node index="1" text="Login again" resource-id="app:id/login2" class="android.widget.Button" package="app" content-desc="" clickable="true" enabled="true" focusable="true" scrollable="false" checkable="false" checked="false" bounds="[100,0][200,50]"></node></hierarchy>');
    expect(() => resolveTextNode(duplicate, 'login')).toThrow(/matched 2 elements/);
  });
  it('retries transient hierarchy failures and then succeeds', async () => {
    const dump = vi.fn().mockRejectedValueOnce(new Error('null root node returned')).mockResolvedValueOnce(XML);
    await expect(dumpHierarchyWithRetry(backend(dump), 'device', 3, 1)).resolves.toBe(XML);
    expect(dump).toHaveBeenCalledTimes(2);
  });
  it('stops after the bounded retry count', async () => {
    const dump = vi.fn().mockRejectedValue(new Error('device busy'));
    await expect(dumpHierarchyWithRetry(backend(dump), 'device', 3, 1)).rejects.toThrow(/after 3 attempts/);
    expect(dump).toHaveBeenCalledTimes(3);
  });
});
