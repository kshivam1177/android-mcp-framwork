import { resolveTarget, runAdbShell } from '../../utils/adb.js';
import { resolveBackend } from '../../automation/index.js';
import type { TargetInfo } from '../../types.js';
import type { AutomationBackend } from '../../automation/backend.js';

export async function resolveTargetAndBackend(
  requestedId?: string
): Promise<{ target: TargetInfo; backend: AutomationBackend }> {
  const target = await resolveTarget({ requestedId });
  const backend = await resolveBackend(target.id);
  return { target, backend };
}

export async function getScreenSize(targetId: string): Promise<{ width: number; height: number }> {
  const result = await runAdbShell(targetId, ['wm', 'size']);
  const match = result.stdout.match(/(\d+)x(\d+)/);
  if (!match) {
    return { width: 1080, height: 2400 }; // reasonable modern-phone fallback if parsing fails
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

export type Direction = 'up' | 'down' | 'left' | 'right';

/** Turns a directional swipe into concrete coordinates using a screen-relative
 * distance (0-1), matching the vocabulary of Xcode-side gesture presets. */
export function directionToCoords(
  direction: Direction,
  screen: { width: number; height: number },
  distance = 0.6
): { startX: number; startY: number; endX: number; endY: number } {
  const cx = screen.width / 2;
  const cy = screen.height / 2;
  const dx = (screen.width * distance) / 2;
  const dy = (screen.height * distance) / 2;
  switch (direction) {
    case 'up':
      return { startX: cx, startY: cy + dy, endX: cx, endY: cy - dy };
    case 'down':
      return { startX: cx, startY: cy - dy, endX: cx, endY: cy + dy };
    case 'left':
      return { startX: cx + dx, startY: cy, endX: cx - dx, endY: cy };
    case 'right':
      return { startX: cx - dx, startY: cy, endX: cx + dx, endY: cy };
  }
}
