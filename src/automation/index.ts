import { loadConfig } from '../config/loader.js';
import { adbBackend } from './adbBackend.js';
import { u2Backend } from './u2Backend.js';
import type { AutomationBackend } from './backend.js';

/**
 * "auto" tries the uiautomator2 bridge first (richer, more robust dumps per
 * openatx/uiautomator2's own docs) and falls back to plain adb if the bridge
 * isn't reachable for this target - never throws on its own, since adb is
 * guaranteed reachable once resolveTarget() has already succeeded.
 */
export async function resolveBackend(targetId: string): Promise<AutomationBackend> {
  const preference = loadConfig().automationBackend;

  if (preference === 'adb') return adbBackend;
  if (preference === 'uiautomator2') return u2Backend;

  const u2Ready = await u2Backend.isAvailable(targetId);
  return u2Ready ? u2Backend : adbBackend;
}

export { adbBackend, u2Backend };
export type { AutomationBackend } from './backend.js';
