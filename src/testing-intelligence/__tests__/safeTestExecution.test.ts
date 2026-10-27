import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { planSafeTestCommand } from '../safeTestExecution.js';

describe('planSafeTestCommand', () => {
  it('plans Flutter unit tests without a device', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'amf-flutter-'));
    await fs.writeFile(path.join(root, 'pubspec.yaml'), 'name: sample\n');
    const plan = planSafeTestCommand({ projectRoot: root, suite: 'unit' });
    expect(plan.args).toEqual(['test']);
    expect(plan.requiresDevice).toBe(false);
    await fs.rm(root, { recursive: true, force: true });
  });
  it('requires integration_test before planning Flutter integration tests', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'amf-flutter-'));
    await fs.writeFile(path.join(root, 'pubspec.yaml'), 'name: sample\n');
    expect(() => planSafeTestCommand({ projectRoot: root, suite: 'integration' })).toThrow('integration_test/');
    await fs.rm(root, { recursive: true, force: true });
  });
  it('rejects malformed Gradle module names and variants', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'amf-gradle-'));
    await fs.writeFile(path.join(root, 'settings.gradle'), "rootProject.name = 'sample'\n");
    expect(() => planSafeTestCommand({ projectRoot: root, suite: 'unit', module: 'app;rm -rf /' })).toThrow('Module');
    expect(() => planSafeTestCommand({ projectRoot: root, suite: 'unit', variant: 'debug;evil' })).toThrow('Variant');
    await fs.rm(root, { recursive: true, force: true });
  });
});
