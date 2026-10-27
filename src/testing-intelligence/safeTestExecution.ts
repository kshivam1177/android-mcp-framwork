export type TestPlatform = 'flutter' | 'android-gradle';
export type TestSuite = 'unit' | 'integration';
import fs from 'node:fs';
import path from 'node:path';

export interface TestCommandPlan {
  platform: TestPlatform;
  suite: TestSuite;
  projectRoot: string;
  executable: string;
  args: string[];
  cwd: string;
  requiresDevice: boolean;
  rationale: string;
}

export function detectTestPlatform(projectRoot: string): TestPlatform | undefined {
  if (fs.existsSync(path.join(projectRoot, 'pubspec.yaml'))) return 'flutter';
  if (fs.existsSync(path.join(projectRoot, 'settings.gradle')) || fs.existsSync(path.join(projectRoot, 'settings.gradle.kts'))) return 'android-gradle';
  return undefined;
}

export function planSafeTestCommand(input: {
  projectRoot: string;
  platform?: TestPlatform;
  suite: TestSuite;
  targetId?: string;
  module?: string;
  variant?: string;
}): TestCommandPlan {
  const root = path.resolve(input.projectRoot);
  const platform = input.platform ?? detectTestPlatform(root);
  if (!platform) throw new Error('No supported Flutter pubspec.yaml or Gradle settings file found at the selected project root.');
  if (platform === 'flutter') {
    if (!fs.existsSync(path.join(root, 'pubspec.yaml'))) throw new Error('Flutter was selected but pubspec.yaml is missing.');
    if (input.suite === 'integration' && !fs.existsSync(path.join(root, 'integration_test'))) {
      throw new Error('Flutter integration suite requested, but integration_test/ does not exist.');
    }
    const executable = process.env.FLUTTER_PATH || 'flutter';
    const args = input.suite === 'unit' ? ['test'] : ['test', '-d', input.targetId ?? '<target-id>', 'integration_test'];
    return { platform, suite: input.suite, projectRoot: root, executable, args, cwd: root,
      requiresDevice: input.suite === 'integration',
      rationale: input.suite === 'unit' ? 'Reuse the project-native Flutter unit/widget test runner.' : 'Reuse Flutter integration_test/ on an explicitly selected device.' };
  }
  if (!fs.existsSync(path.join(root, 'settings.gradle')) && !fs.existsSync(path.join(root, 'settings.gradle.kts'))) {
    throw new Error('Native Android was selected but no Gradle settings file exists at the selected root.');
  }
  const module = (input.module ?? '').trim().replace(/^:+|:+$/g, '');
  if (module && !/^[A-Za-z0-9_.-]+(?::[A-Za-z0-9_.-]+)*$/.test(module)) throw new Error('Module contains unsupported characters.');
  const variant = input.variant ?? 'debug';
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(variant)) throw new Error('Variant must be an alphanumeric Gradle variant name.');
  const prefix = module ? ':' + module.replace(/:/g, ':') + ':' : '';
  const cap = variant[0]!.toUpperCase() + variant.slice(1);
  const task = input.suite === 'unit' ? 'test' + cap + 'UnitTest' : 'connected' + cap + 'AndroidTest';
  return { platform, suite: input.suite, projectRoot: root, executable: 'Gradle wrapper / Gradle',
    args: [prefix + task, '--console=plain'], cwd: root, requiresDevice: input.suite === 'integration',
    rationale: input.suite === 'unit' ? 'Reuse the native Android Gradle unit-test task.' : 'Reuse the native Android connected instrumentation-test task.' };
}
