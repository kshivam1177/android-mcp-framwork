import fs from 'node:fs/promises';
import path from 'node:path';

export interface EvidenceReference {
  sourceReport: string;
  path: string;
  exists: boolean;
  kind: 'screenshot' | 'log' | 'snapshot' | 'recording' | 'other';
}
const EVIDENCE_KEYS = new Set(['evidence', 'artifacts', 'screenshots', 'logs', 'snapshots', 'recordings', 'bugreports']);
function kindFor(value: string): EvidenceReference['kind'] {
  const ext = path.extname(value).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return 'screenshot';
  if (['.log', '.txt'].includes(ext)) return 'log';
  if (value.toLowerCase().includes('snapshot') || ext === '.xml') return 'snapshot';
  if (value.toLowerCase().includes('recording') || ['.mp4', '.webm'].includes(ext)) return 'recording';
  return 'other';
}
function collectStrings(value: unknown, key: string, output: string[]): void {
  if (typeof value === 'string') {
    if (EVIDENCE_KEYS.has(key) || /\.(png|jpe?g|webp|log|txt|xml|mp4|webm|json)$/i.test(value)) output.push(value);
    return;
  }
  if (Array.isArray(value)) { for (const item of value) collectStrings(item, key, output); return; }
  if (value && typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) collectStrings(child, childKey, output);
  }
}
export async function aggregateEvidence(projectRoot: string, reports: string[]): Promise<EvidenceReference[]> {
  const root = path.resolve(projectRoot);
  const refs: EvidenceReference[] = [];
  for (const reportPath of reports) {
    let parsed: unknown;
    try { parsed = JSON.parse(await fs.readFile(reportPath, 'utf8')); } catch { continue; }
    const candidates: string[] = [];
    collectStrings(parsed, '', candidates);
    for (const candidate of new Set(candidates)) {
      const normalized = candidate.replace(/\\/g, '/');
      if (/^[a-z]+:\/\//i.test(normalized) || path.isAbsolute(normalized)) continue;
      const absolute = path.resolve(root, normalized);
      const relative = path.relative(root, absolute);
      if (relative.startsWith('..') || path.isAbsolute(relative)) continue;
      let exists = false;
      try { exists = (await fs.stat(absolute)).isFile(); } catch { /* retain missing evidence references */ }
      refs.push({ sourceReport: path.relative(root, reportPath).split(path.sep).join('/'), path: relative.split(path.sep).join('/'), exists, kind: kindFor(normalized) });
    }
  }
  return refs;
}
