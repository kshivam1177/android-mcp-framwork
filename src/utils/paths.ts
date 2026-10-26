import path from 'node:path';
import { access } from 'node:fs/promises';

export function resolveProjectPath(inputPath: string, cwd = process.cwd()): string {
  const resolved = path.resolve(cwd, inputPath);
  const relative = path.relative(path.resolve(cwd), resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Path escapes project root: ${inputPath}`);
  return resolved;
}

export async function fileExists(filePath: string): Promise<boolean> {
  try { await access(filePath); return true; } catch { return false; }
}
