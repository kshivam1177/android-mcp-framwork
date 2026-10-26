import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveSessionProjectPath } from '../defaults.js';

describe('session project path discovery', () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it('selects the Flutter app package in a monorepo instead of assuming ./app', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'amf-session-flutter-'));
    roots.push(root);
    const flutterRoot = path.join(root, 'apps', 'customer-mobile');
    fs.mkdirSync(path.join(root, '.git'), { recursive: true });
    fs.mkdirSync(path.join(flutterRoot, 'android'), { recursive: true });
    fs.writeFileSync(path.join(flutterRoot, 'pubspec.yaml'), 'name: customer_mobile\n');
    fs.writeFileSync(path.join(flutterRoot, 'android', 'settings.gradle'), 'rootProject.name = "customer_mobile"\n');

    expect(resolveSessionProjectPath({}, root).projectPath).toBe(flutterRoot);
    expect(resolveSessionProjectPath({ projectPath: './app' }, root).projectPath).toBe(flutterRoot);
  });

  it('uses the native Gradle workspace root when it exists', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'amf-session-native-'));
    roots.push(root);
    fs.mkdirSync(path.join(root, '.git'), { recursive: true });
    fs.mkdirSync(path.join(root, 'app'), { recursive: true });
    fs.writeFileSync(path.join(root, 'settings.gradle'), 'rootProject.name = "native"\n');

    expect(resolveSessionProjectPath({ projectPath: './app' }, root).projectPath).toBe(root);
  });
});
