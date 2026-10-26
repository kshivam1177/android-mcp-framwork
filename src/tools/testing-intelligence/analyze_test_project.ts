import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import type { ToolModule } from '../types.js';

export const toolName = 'analyze_test_project';
export const workflow = 'testing-intelligence';
const SKIP = new Set(['.git', '.gradle', '.dart_tool', '.idea', '.androidmcp-framework', '.android-build-mcp', '.androidbuildmcp', 'node_modules', 'build', 'Pods', '.symlinks']);
const MARKERS = new Set(['pubspec.yaml', 'pubspec.lock', 'settings.gradle', 'settings.gradle.kts', 'build.gradle', 'build.gradle.kts', 'gradlew', 'gradlew.bat', 'AndroidManifest.xml', 'package.json', 'analysis_options.yaml']);
function walk(root: string, rel = '', depth = 0, out: string[] = []): string[] {
  if (depth > 7 || out.length > 12000) return out;
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name) && !entry.name.startsWith('.')) walk(root, path.join(rel, entry.name), depth + 1, out);
    } else if (entry.isFile()) {
      const file = path.join(rel, entry.name);
      if (MARKERS.has(entry.name) || /\.(kt|kts|java|dart)$/.test(entry.name) || ['test', 'tests', 'androidTest', 'integration_test'].some(part => file.split(path.sep).includes(part))) out.push(file);
    }
  }
  return out;
}
function git(root: string, args: string[]): string[] {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).split(/\r?\n/).filter(Boolean); } catch { return []; }
}
export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Analyze Test Project',
    description: 'Inspect a repository for Native Android and Flutter structure, existing tests, and changed files. Read-only; does not run builds or modify files.',
    inputSchema: { projectPath: z.string().optional().describe('Project root; defaults to current working directory.'), baseRef: z.string().optional().describe('Optional Git ref to compare against, e.g. origin/main.') },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, withErrorHandling(async (args: { projectPath?: string; baseRef?: string }) => {
    const root = path.resolve(args.projectPath ?? process.cwd());
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`Project directory does not exist: ${root}`);
    const files = walk(root);
    const relative = (f: string) => f.split(path.sep).join('/');
    const flutter = files.some(f => path.basename(f) === 'pubspec.yaml') || files.some(f => f.endsWith('.dart'));
    const native = files.some(f => /(^|\/)settings\.gradle(\.kts)?$/.test(relative(f))) || files.some(f => /\.(kt|java)$/.test(f));
    const tests = files.filter(f => ['test', 'tests', 'androidTest', 'integration_test'].some(part => relative(f).split('/').includes(part)) || /Test\.(kt|java)$/.test(f));
    const changed = args.baseRef ? git(root, ['diff', '--name-only', `${args.baseRef}...HEAD`]) : git(root, ['status', '--short']);
    const result = { projectRoot: root, platforms: { nativeAndroid: native, flutter }, detectedFiles: files.length, testFiles: tests.map(relative).slice(0, 500), changedFiles: changed, recommendations: [!tests.length ? 'No conventional test files detected; inspect project-specific test conventions before generating tests.' : 'Reuse existing tests and conventions before generating new ones.', flutter ? 'Flutter: inspect pubspec.yaml, test/, integration_test/, and flutter test availability.' : null, native ? 'Native Android: inspect Gradle modules, src/test, src/androidTest, and available device targets.' : null, 'Review uncommitted changes before interpreting Git status as the complete change set.'].filter(Boolean) };
    return textResult(JSON.stringify(result, null, 2), result);
  }));
}
const mod: ToolModule = { toolName, workflow, register };
export default mod;
