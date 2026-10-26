import type { AutomationBackend, UiSnapshot } from './backend.js';
import { parseUiHierarchy } from './uiHierarchy.js';
import { adb } from '../utils/adb.js';
import { writeFile, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export class AdbBackend implements AutomationBackend {
  async listDevices() { const { listAdbDevices } = await import('../utils/adb.js'); return listAdbDevices(); }
  async screenshot(serial?: string): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), 'androidbuildmcp-'));
    const remote = '/sdcard/androidbuildmcp-screen.png';
    await adb(['shell', 'screencap', '-p', remote], serial);
    const local = path.join(dir, 'screen.png');
    await adb(['pull', remote, local], serial);
    return (await readFile(local)).toString('base64');
  }
  async snapshot(serial?: string): Promise<UiSnapshot> {
    const remote = '/sdcard/androidbuildmcp-hierarchy.xml';
    await adb(['shell', 'uiautomator', 'dump', remote], serial, 45000);
    const dir = await mkdtemp(path.join(tmpdir(), 'androidbuildmcp-'));
    const local = path.join(dir, 'hierarchy.xml');
    await adb(['pull', remote, local], serial);
    const rawXml = await readFile(local, 'utf8');
    const size = (await adb(['shell', 'wm', 'size'], serial)).stdout;
    const match = /Physical size:\s*(\d+)x(\d+)/.exec(size) ?? /Override size:\s*(\d+)x(\d+)/.exec(size);
    return { width: Number(match?.[1] ?? 0), height: Number(match?.[2] ?? 0), timestamp: Date.now(), elements: parseUiHierarchy(rawXml), rawXml };
  }
  async tap(x: number, y: number, serial?: string) { return adb(['shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y))], serial); }
  async typeText(text: string, serial?: string) { return adb(['shell', 'input', 'text', text.replace(/\s/g, '%s')], serial); }
  async pressKey(key: string, serial?: string) { const keys: Record<string,string> = { ENTER: '66', BACK: '4', TAB: '61', DONE: '66' }; return adb(['shell', 'input', 'keyevent', keys[key.toUpperCase()] ?? key], serial); }
}
