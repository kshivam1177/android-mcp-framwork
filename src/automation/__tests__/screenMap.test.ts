import { describe, expect, it } from 'vitest';
import { createScreenMap } from '../screenMap.js';
import type { UiNode } from '../../types.js';

const node: UiNode = {
  ref: 'e1', index: 0, packageName: 'com.example.app',
  resourceId: 'com.example.app:id/submit', text: 'Continue', className: 'android.widget.Button',
  bounds: { left: 10, top: 20, right: 110, bottom: 70 },
  centerX: 60, centerY: 45, clickable: true, enabled: true, focusable: true,
  scrollable: false, checkable: false, checked: false, depth: 2,
};

describe('createScreenMap', () => {
  it('stores selectors, absolute and normalized coordinates, and a stable fingerprint', () => {
    const options = {
      screenId: 'login', deviceId: 'emulator-5554', backend: 'adb',
      screenshotPath: '.androidmcp-framework/screen-maps/images/login.png',
      width: 120, height: 90, nodes: [node], capturedAt: '2026-10-26T00:00:00.000Z',
    };
    const map = createScreenMap(options);
    expect(map.elements[0]?.selector.resourceId).toBe('com.example.app:id/submit');
    expect(map.elements[0]?.center).toEqual({ x: 60, y: 45 });
    expect(map.elements[0]?.normalizedCoordinates).toEqual({ x: 0.5, y: 0.5 });
    expect(map.fingerprint).toBe(createScreenMap(options).fingerprint);
  });

  it('rejects unsafe screen ids and invalid dimensions', () => {
    expect(() => createScreenMap({
      screenId: '../login', deviceId: 'device', backend: 'adb', screenshotPath: 'login.png',
      width: 100, height: 100, nodes: [node],
    })).toThrow(/screenId/);
    expect(() => createScreenMap({
      screenId: 'login', deviceId: 'device', backend: 'adb', screenshotPath: 'login.png',
      width: 0, height: 100, nodes: [node],
    })).toThrow(/dimensions/);
  });
});
