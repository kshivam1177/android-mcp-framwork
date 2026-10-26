import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execCommand } from '../utils/exec.js';
import { AndroidBuildMcpError } from '../types.js';
import type { AutomationBackend } from './backend.js';
import { adbBackend } from './adbBackend.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
// build/automation/u2Backend.js -> ../../scripts/u2_bridge.py (build/ and
// scripts/ are siblings once installed - scripts/ ships via package.json's
// "files" array rather than being compiled).
const BRIDGE_SCRIPT = path.resolve(moduleDir, '..', '..', 'scripts', 'u2_bridge.py');

function pythonCommand(): string {
  return process.platform === 'win32' ? 'python' : 'python3';
}

interface BridgeEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function callBridge<T>(serial: string, command: string, args: string[] = []): Promise<T> {
  const result = await execCommand(pythonCommand(), [BRIDGE_SCRIPT, serial, command, ...args], {
    timeoutMs: 30_000,
  });

  const lastLine = result.stdout.trim().split('\n').pop() ?? '';
  let parsed: BridgeEnvelope<T>;
  try {
    parsed = JSON.parse(lastLine) as BridgeEnvelope<T>;
  } catch {
    throw new AndroidBuildMcpError(
      'AUTOMATION_BACKEND_UNAVAILABLE',
      `uiautomator2 bridge returned unparseable output for "${command}": ${
        (result.stdout || result.stderr).slice(0, 500) || '(empty)'
      }`
    );
  }
  if (!parsed.ok) {
    throw new AndroidBuildMcpError(
      'AUTOMATION_BACKEND_UNAVAILABLE',
      `uiautomator2 backend failed on "${command}": ${parsed.error ?? 'unknown error'}`
    );
  }
  return parsed.data as T;
}

export const u2Backend: AutomationBackend = {
  name: 'uiautomator2',

  async isAvailable(targetId: string): Promise<boolean> {
    try {
      await callBridge(targetId, 'ping');
      return true;
    } catch {
      return false;
    }
  },

  async dumpHierarchy(targetId: string): Promise<string> {
    return callBridge<string>(targetId, 'dump_hierarchy');
  },

  async tap(targetId: string, x: number, y: number): Promise<void> {
    await callBridge(targetId, 'tap', [String(x), String(y)]);
  },

  async longPress(targetId: string, x: number, y: number, durationMs = 600): Promise<void> {
    await callBridge(targetId, 'long_press', [String(x), String(y), String(durationMs / 1000)]);
  },

  async swipe(targetId: string, startX: number, startY: number, endX: number, endY: number, durationMs = 300): Promise<void> {
    await callBridge(targetId, 'swipe', [
      String(startX),
      String(startY),
      String(endX),
      String(endY),
      String(durationMs / 1000),
    ]);
  },

  async drag(targetId: string, startX: number, startY: number, endX: number, endY: number, durationMs = 800): Promise<void> {
    await callBridge(targetId, 'drag', [
      String(startX),
      String(startY),
      String(endX),
      String(endY),
      String(durationMs / 1000),
    ]);
  },

  // Text entry and key events go through the same adb-based implementation
  // regardless of which backend is active: `input text`/`input keyevent`
  // don't depend on which hierarchy-dump mechanism is in use, and this
  // avoids guessing at a uiautomator2 method name this project hasn't
  // independently verified.
  async typeText(targetId: string, text: string): Promise<void> {
    await adbBackend.typeText(targetId, text);
  },

  async keyEvent(targetId: string, keyCode: string): Promise<void> {
    await adbBackend.keyEvent(targetId, keyCode);
  },

  async screenshot(targetId: string): Promise<{ data: Buffer; mimeType: string }> {
    const base64 = await callBridge<string>(targetId, 'screenshot');
    return { data: Buffer.from(base64, 'base64'), mimeType: 'image/jpeg' };
  },
};
