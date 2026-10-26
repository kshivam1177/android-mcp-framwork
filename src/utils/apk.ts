import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export async function findApks(root: string): Promise<string[]> {
  const found: string[] = [];
  async function visit(dir: string): Promise<void> {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.gradle' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.apk')) found.push(full);
    }
  }
  await visit(root);
  return found.sort(async (a, b) => (await stat(b)).mtimeMs - (await stat(a)).mtimeMs);
}
