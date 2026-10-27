import { describe, expect, it } from 'vitest';
import { aggregateEvidence } from '../evidenceAggregation.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

describe('aggregateEvidence', () => {
  it('indexes relative evidence paths and marks missing artifacts', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'amf-evidence-'));
    const report = path.join(root, 'report.json');
    await fs.writeFile(path.join(root, 'shot.png'), 'fake');
    await fs.writeFile(report, JSON.stringify({ evidence: ['shot.png', 'missing.log'] }));
    const refs = await aggregateEvidence(root, [report]);
    expect(refs.some(item => item.path === 'shot.png' && item.exists)).toBe(true);
    expect(refs.some(item => item.path === 'missing.log' && !item.exists)).toBe(true);
    await fs.rm(root, { recursive: true, force: true });
  });
});
