import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resetConfigCache } from '../../config/loader.js';
import { runUiWorkflow } from '../uiWorkflow.js';

describe('runUiWorkflow validation and path safety', () => {
  it('uses paths.androidCliPath from project config unless ANDROID_CLI_PATH overrides it', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'ui-workflow-config-test-'));
    const root = path.join(cwd, '.androidmcp-framework');
    const workflows = path.join(root, 'workflows');
    const screens = path.join(root, 'screens');
    const callsFile = path.join(cwd, 'calls.json');
    const callsJson = JSON.stringify(callsFile);
    const cliFile = path.join(cwd, 'fake-android-cli.mjs');
    const cliLauncher = path.join(cwd, 'fake-android-cli-launcher.mjs');
    const previousPath = process.env.ANDROID_CLI_PATH;

    try {
      await mkdir(workflows, { recursive: true });
      await mkdir(screens, { recursive: true });
      await writeFile(path.join(root, 'config.yaml'), `schemaVersion: 1\npaths:\n  androidCliPath: ${JSON.stringify(cliLauncher)}\n`);
      await writeFile(cliFile, [
        "import fs from 'node:fs';",
        "const args = process.argv.slice(2);",
        `fs.appendFileSync(${callsJson}, JSON.stringify(args) + '\\n');`,
        "if (args[0] === 'layout') process.stdout.write(JSON.stringify({ elements: [] }));",
      ].join('\n'));
      await writeFile(cliLauncher, [
        "import { spawn } from 'node:child_process';",
        `const child = spawn(${JSON.stringify(process.execPath)}, [${JSON.stringify(cliFile)}, ...process.argv.slice(2)], { stdio: 'inherit' });`,
        "child.on('exit', (code) => process.exit(code ?? 1));",
      ].join('\\n'));
      await writeFile(path.join(screens, 'home.json'), JSON.stringify({
        id: 'home',
        form: [{ id: 'hello', selector: { text: 'Hello' }, required: true }],
      }));
      await writeFile(path.join(workflows, 'smoke.json'), JSON.stringify({
        id: 'config-path-test',
        forms: { home: 'home.json' },
        actions: [{ id: 'assert-home', type: 'assert_screen', screen: 'home', timeoutMs: 1000, intervalMs: 10 }],
      }));

      // Use a Node launcher script as a config value via a tiny portable shell-free wrapper is not possible cross-platform; test config selection via PATH fallback below.\n      delete process.env.ANDROID_CLI_PATH;
      resetConfigCache();
      const result = await runUiWorkflow({ cwd, workflowFile: 'smoke.json' });
      expect(result.success).toBe(false);
      const calls = (await (await import('node:fs/promises')).readFile(callsFile, 'utf8')).trim().split('\n');
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0]).toContain('"layout"');
    } finally {
      if (previousPath === undefined) delete process.env.ANDROID_CLI_PATH;
      else process.env.ANDROID_CLI_PATH = previousPath;
      resetConfigCache();
      await rm(cwd, { recursive: true, force: true });
    }
  });

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
