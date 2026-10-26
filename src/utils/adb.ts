import { execFile } from './exec.js';

export async function adb(args: string[], serial?: string, timeoutMs = 30000) {
  const adbPath = process.env.ADB_PATH || 'adb';
  const fullArgs = serial ? ['-s', serial, ...args] : args;
  const result = await execFile(adbPath, fullArgs, { timeoutMs });
  if (result.exitCode !== 0) throw new Error(`adb ${fullArgs.join(' ')} failed (${result.exitCode}): ${result.stderr || result.stdout}`);
  return result;
}

export async function listAdbDevices() {
  const result = await adb(['devices', '-l']);
  return result.stdout.split(/\r?\n/).slice(1).filter(line => line.trim()).map(line => {
    const [serial, state, ...rest] = line.trim().split(/\s+/);
    return { serial, state, details: rest.join(' ') };
  });
}
