import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPathInsideDirectory, readPackageVersion, runSelfUpdate } from '../update.js';

describe('amf update helpers', () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it('detects whether the CLI belongs to the global npm installation', () => {
    const root = path.join(os.tmpdir(), 'npm-global');
    expect(isPathInsideDirectory(path.join(root, 'node_modules', 'androidmcp-framework'), root)).toBe(true);
    expect(isPathInsideDirectory(path.join(os.tmpdir(), 'project', 'node_modules', 'androidmcp-framework'), root)).toBe(false);
    expect(isPathInsideDirectory(root, root)).toBe(true);
  });

  it('reads package versions safely', () => {
    expect(readPackageVersion('{"version":"1.2.3"}')).toBe('1.2.3');
    expect(readPackageVersion('{"version":3}')).toBeUndefined();
    expect(readPackageVersion('not json')).toBeUndefined();
  });

  it('installs latest, clears npm cache, and verifies the installed version', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'amf-update-'));
    roots.push(root);
    const globalRoot = path.join(root, 'node_modules');
    const packageRoot = path.join(globalRoot, 'androidmcp-framework');
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.writeFileSync(path.join(packageRoot, 'package.json'), '{"name":"androidmcp-framework","version":"1.0.0"}');
    const calls: string[][] = [];
    const runner = (args: string[]) => {
      calls.push(args);
      if (args[0] === 'root') return globalRoot;
      if (args[0] === 'view') return '1.2.3';
      if (args[0] === 'list') return JSON.stringify({ dependencies: { 'androidmcp-framework': { version: '1.2.3' } } });
      return '';
    };
    const log = vi.fn();

    const result = runSelfUpdate(packageRoot, runner, log);

    expect(result).toMatchObject({ success: true, currentVersion: '1.0.0', latestVersion: '1.2.3', installedVersion: '1.2.3' });
    expect(calls).toContainEqual(['install', '--global', 'androidmcp-framework@latest']);
    expect(calls).toContainEqual(['cache', 'clean', '--force']);
    expect(calls).toContainEqual(['list', '--global', '--depth=0', '--json']);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('clears npm cache entries for all projects'));
  });

  it('refuses to update a non-global npx or local checkout', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'amf-update-local-'));
    roots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), '{"version":"1.0.0"}');
    const log = vi.fn();
    const runner = (args: string[]) => args[0] === 'root' ? path.join(root, 'global-node-modules') : '';
    const result = runSelfUpdate(root, runner, log);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Install it globally first');
  });
});
