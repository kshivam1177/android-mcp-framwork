import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverWorkspaceProjects, findFlutterProjectRoot, flutterAndroidRoot } from '../projectDiscovery.js';

describe('Flutter workspace discovery', () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it('finds Flutter apps nested in a monorepo and their Android host/test folders', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'amf-flutter-monorepo-'));
    roots.push(root);
    const app = path.join(root, 'packages', 'mobile-app');
    fs.mkdirSync(path.join(root, '.git'), { recursive: true });
    fs.mkdirSync(path.join(app, 'android'), { recursive: true });
    fs.mkdirSync(path.join(app, 'test'), { recursive: true });
    fs.mkdirSync(path.join(app, 'integration_test'), { recursive: true });
    fs.writeFileSync(path.join(app, 'pubspec.yaml'), 'name: mobile_app\n');
    fs.writeFileSync(path.join(app, 'android', 'settings.gradle'), 'rootProject.name = "mobile_app"\n');

    const result = discoverWorkspaceProjects(root);
    expect(result.workspaceRoot).toBe(root);
    expect(result.flutterProjects).toHaveLength(1);
    expect(result.flutterProjects[0]).toMatchObject({
      projectRoot: app,
      hasAndroidHost: true,
      hasUnitTests: true,
      hasIntegrationTests: true,
    });
    expect(findFlutterProjectRoot(root)).toBe(app);
    expect(flutterAndroidRoot(app)).toBe(path.join(app, 'android'));
  });
});
