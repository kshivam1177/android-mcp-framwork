import { describe, expect, it } from 'vitest';
import { UiMapCache } from '../uiMapCache.js';

describe('UiMapCache', () => {
  it('reuses a fresh map and returns a defensive copy', () => {
    let now = 1_000;
    const cache = new UiMapCache({ ttlMs: 500, now: () => now });
    cache.set({ key: 'device-a:login', capturedAt: now, appVersion: '1.0', elements: [{ id: 'login', label: 'Sign in', clickable: true }] });
    const first = cache.get('device-a:login', { appVersion: '1.0' });
    expect(first?.elements[0]?.label).toBe('Sign in');
    if (first) first.elements[0]!.label = 'mutated';
    expect(cache.get('device-a:login')?.elements[0]?.label).toBe('Sign in');
    now += 501;
    expect(cache.get('device-a:login')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('invalidates a cached map when app or source fingerprint changes', () => {
    const cache = new UiMapCache({ now: () => 10 });
    cache.set({ key: 'device-a:home', capturedAt: 10, appVersion: '1.0', sourceFingerprint: 'abc', elements: [] });
    expect(cache.get('device-a:home', { appVersion: '2.0' })).toBeUndefined();
    cache.set({ key: 'device-a:home', capturedAt: 10, appVersion: '1.0', sourceFingerprint: 'abc', elements: [] });
    expect(cache.get('device-a:home', { sourceFingerprint: 'changed' })).toBeUndefined();
  });

  it('supports explicit invalidation after navigation or state changes', () => {
    const cache = new UiMapCache();
    cache.set({ key: 'device-a:login', capturedAt: Date.now(), elements: [] });
    expect(cache.invalidate('device-a:login')).toBe(true);
    expect(cache.invalidate('device-a:login')).toBe(false);
    cache.set({ key: 'a', capturedAt: Date.now(), elements: [] });
    cache.set({ key: 'b', capturedAt: Date.now(), elements: [] });
    cache.invalidateAll();
    expect(cache.size).toBe(0);
  });

  it('rejects empty keys and normalizes missing element IDs', () => {
    const cache = new UiMapCache();
    expect(() => cache.set({ key: ' ', capturedAt: Date.now(), elements: [] })).toThrow('key');
    cache.set({ key: 'device-a:form', capturedAt: Date.now(), elements: [{ id: '', label: 'Email' }] });
    expect(cache.get('device-a:form')?.elements[0]?.id).toBe('element-1');
  });
});
