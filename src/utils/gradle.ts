import { execFile } from './exec.js';
import path from 'node:path';

export async function runGradle(args: string[], cwd = process.cwd(), timeoutMs = 10 * 60 * 1000) {
  const wrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  const wrapperPath = path.join(cwd, wrapper);
  const result = await execFile(wrapperPath, args, { cwd, timeoutMs, maxOutputBytes: 8 * 1024 * 1024 });
  if (result.exitCode !== 0) throw new Error(`Gradle failed (${result.exitCode}): ${result.stderr || result.stdout}`);
  return result;
}
