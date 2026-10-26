import { adbBackend } from './adbBackend.js';
import type { AutomationBackend } from './backend.js';

/** UI automation stays dependency-light and uses Android SDK platform-tools only. */
export async function resolveBackend(_targetId: string): Promise<AutomationBackend> {
  return adbBackend;
}

export { adbBackend };
export type { AutomationBackend } from './backend.js';
