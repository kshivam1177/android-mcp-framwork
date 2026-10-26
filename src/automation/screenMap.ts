import { createHash } from 'node:crypto';
import type { UiNode } from '../types.js';

export interface ScreenMapElement {
  id: string;
  selector: { resourceId?: string; text?: string; contentDesc?: string; className?: string };
  bounds: UiNode['bounds'];
  center: { x: number; y: number };
  normalizedCoordinates: { x: number; y: number };
  clickable: boolean;
  enabled: boolean;
  focusable: boolean;
  scrollable: boolean;
  checkable: boolean;
  checked: boolean;
  depth: number;
}

export interface ScreenMap {
  schemaVersion: 1;
  screenId: string;
  capturedAt: string;
  appPackage?: string;
  deviceId: string;
  backend: string;
  display: { width: number; height: number };
  fingerprint: string;
  screenshot: string;
  elements: ScreenMapElement[];
}

export function createScreenMap(options: {
  screenId: string;
  deviceId: string;
  backend: string;
  screenshotPath: string;
  width: number;
  height: number;
  nodes: UiNode[];
  capturedAt?: string;
}): ScreenMap {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(options.screenId)) {
    throw new Error('screenId must be 1-80 characters and contain only letters, numbers, dot, underscore, or hyphen.');
  }
  if (!Number.isFinite(options.width) || !Number.isFinite(options.height) || options.width <= 0 || options.height <= 0) {
    throw new Error('Screen dimensions must be positive numbers.');
  }
  const elements = options.nodes.map((node, index): ScreenMapElement => {
    const selector = {
      ...(node.resourceId ? { resourceId: node.resourceId } : {}),
      ...(node.text ? { text: node.text } : {}),
      ...(node.contentDesc ? { contentDesc: node.contentDesc } : {}),
      ...(node.className ? { className: node.className } : {}),
    };
    const identity = node.resourceId || node.contentDesc || node.text || node.className || 'element';
    const id = identity.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(-60) || 'element';
    return {
      id: `${id}-${index + 1}`,
      selector,
      bounds: node.bounds,
      center: { x: node.centerX, y: node.centerY },
      normalizedCoordinates: {
        x: Number((node.centerX / options.width).toFixed(6)),
        y: Number((node.centerY / options.height).toFixed(6)),
      },
      clickable: node.clickable,
      enabled: node.enabled,
      focusable: node.focusable,
      scrollable: node.scrollable,
      checkable: node.checkable,
      checked: node.checked,
      depth: node.depth,
    };
  });
  const fingerprintPayload = JSON.stringify({
    appPackage: options.nodes.find((node) => node.packageName)?.packageName ?? '',
    display: { width: options.width, height: options.height },
    elements: elements.map(({ selector, bounds, clickable, enabled }) => ({ selector, bounds, clickable, enabled })),
  });
  return {
    schemaVersion: 1,
    screenId: options.screenId,
    capturedAt: options.capturedAt ?? new Date().toISOString(),
    ...(options.nodes.find((node) => node.packageName)?.packageName
      ? { appPackage: options.nodes.find((node) => node.packageName)?.packageName }
      : {}),
    deviceId: options.deviceId,
    backend: options.backend,
    display: { width: options.width, height: options.height },
    fingerprint: createHash('sha256').update(fingerprintPayload).digest('hex'),
    screenshot: options.screenshotPath,
    elements,
  };
}
