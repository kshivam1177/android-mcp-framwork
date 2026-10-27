import { createHash } from 'node:crypto';
import { readdir, readFile, stat, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

export interface KnowledgeAsset {
  path: string;
  kind: 'test-case' | 'instruction' | 'screen' | 'recording' | 'workflow' | 'report' | 'other';
  sha256: string;
  bytes: number;
  updatedAt: string;
}
export interface KnowledgeManifest {
  schemaVersion: 1;
  generatedAt: string;
  projectRoot: string;
  assets: KnowledgeAsset[];
  changesSinceLastRefresh: { added: string[]; changed: string[]; removed: string[] };
  staleTestCases: Array<{ id: string; file: string; changedPaths: string[] }>;
  latestKnownFailures: Array<{ report: string; failedSteps: number; createdAt?: string }>;
  warnings: string[];
}
const INDEXED_EXTENSIONS = new Set(['.json', '.md']);
const MANIFEST_NAME = 'test-knowledge.json';

function kindFor(relative: string): KnowledgeAsset['kind'] {
  const p = relative.replaceAll('\\\\', '/');
  if (p.startsWith('testcases/')) return 'test-case';
  if (p.startsWith('instructions/')) return 'instruction';
  if (p.startsWith('screens/')) return 'screen';
  if (p.startsWith('recordings/') || p.startsWith('action-sequences/')) return 'recording';
  if (p.startsWith('workflows/')) return 'workflow';
  if (p.startsWith('test-reports/')) return 'report';
  return 'other';
}
async function walk(root: string, current: string, assets: KnowledgeAsset[]): Promise<void> {
  let entries;
  try { entries = await readdir(current, { withFileTypes: true }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await walk(root, absolute, assets);
      continue;
    }
    if (!entry.isFile() || !INDEXED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    if (relative === MANIFEST_NAME) continue;
    const contents = await readFile(absolute);
    const metadata = await stat(absolute);
    assets.push({
      path: relative,
      kind: kindFor(relative),
      sha256: createHash('sha256').update(contents).digest('hex'),
      bytes: contents.byteLength,
      updatedAt: metadata.mtime.toISOString(),
    });
  }
}
export async function scanKnowledgeAssets(configDir: string): Promise<KnowledgeAsset[]> {
  const root = path.resolve(configDir);
  const assets: KnowledgeAsset[] = [];
  await walk(root, root, assets);
  return assets.sort((a, b) => a.path.localeCompare(b.path));
}
export function compareKnowledgeAssets(previous: KnowledgeAsset[], current: KnowledgeAsset[]): KnowledgeManifest['changesSinceLastRefresh'] {
  const before = new Map(previous.map(asset => [asset.path, asset.sha256]));
  const after = new Map(current.map(asset => [asset.path, asset.sha256]));
  const added: string[] = [];
  const changed: string[] = [];
  const removed: string[] = [];
  for (const [file, hash] of after) {
    if (!before.has(file)) added.push(file);
    else if (before.get(file) !== hash) changed.push(file);
  }
  for (const file of before.keys()) if (!after.has(file)) removed.push(file);
  return { added: added.sort(), changed: changed.sort(), removed: removed.sort() };
}
export async function readKnowledgeManifest(file: string): Promise<KnowledgeManifest | undefined> {
  try {
    const value: unknown = JSON.parse(await readFile(file, 'utf8'));
    if (!value || typeof value !== 'object' || (value as { schemaVersion?: unknown }).schemaVersion !== 1 || !Array.isArray((value as { assets?: unknown }).assets)) return undefined;
    return value as KnowledgeManifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw new Error(`Could not read prior testing knowledge manifest: ${(error as Error).message}`);
  }
}
export async function writeKnowledgeManifest(file: string, manifest: KnowledgeManifest): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(manifest, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  try { await rename(temporary, file); }
  catch (error) {
    const { unlink } = await import('node:fs/promises');
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}
