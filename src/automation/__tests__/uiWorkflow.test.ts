import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runUiWorkflow } from '../uiWorkflow.js';

describe('runUiWorkflow validation and path safety', () => {
  it('rejects traversal paths before executing commands', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'ui-workflow-test-'));
    try {
      await mkdir(path.join(cwd, '.androidmcp-framework', 'workflows'), { recursive: true });
      await expect(runUiWorkflow({ cwd, workflowFile: '../outside.json' })).rejects.toThrow(/escapes|Absolute paths/);
    } finally { await rm(cwd, { recursive: true, force: true }); }
  });

  it('rejects unsupported action types without launching Android CLI', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'ui-workflow-test-'));
    try {
      const root = path.join(cwd, '.androidmcp-framework');
      await mkdir(path.join(root, 'workflows'), { recursive: true });
      await mkdir(path.join(root, 'screens'), { recursive: true });
      await writeFile(path.join(root, 'workflows', 'invalid.json'), JSON.stringify({
        id: 'bad-flow', forms: {}, actions: [{ id: 'bad-step', type: 'exec', command: 'whoami' }]
      }));
      await expect(runUiWorkflow({ cwd, workflowFile: 'invalid.json' })).rejects.toThrow(/supported type/);
    } finally { await rm(cwd, { recursive: true, force: true }); }
  });
});
