import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createArtifactPath, timestampedArtifactName } from '../artifacts.js';

describe('project artifact paths', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('creates generated artifacts under the project config directory', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'androidmcp-artifacts-'));
    roots.push(root);

    const output = createArtifactPath(root, 'screenshots', 'home-screen.png');

    expect(output).toBe(path.join(root, '.androidmcp-framework', 'artifacts', 'screenshots', 'home-screen.png'));
    expect(fs.existsSync(path.dirname(output))).toBe(true);
  });

  it('rejects categories that could escape the artifacts directory', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'androidmcp-artifacts-'));
    roots.push(root);

    expect(() => createArtifactPath(root, '../outside', 'file.json')).toThrow('Invalid artifact category');
  });

  it('creates filesystem-safe timestamped names', () => {
    const name = timestampedArtifactName('device/id', '.png', new Date('2026-10-26T10:11:12.123Z'));
    expect(name).toBe('device_id-2026-10-26T10-11-12-123Z.png');
  });
});
