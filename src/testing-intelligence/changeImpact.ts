import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export type ChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'unknown';
export interface ChangedFile { status: ChangeStatus; path: string; previousPath?: string; }
export interface ImpactAnalysis {
  base: string;
  head: string;
  changedFiles: ChangedFile[];
  selectedSuites: string[];
  fallbackToBroadRun: boolean;
  rationale: string[];
}

const statusMap: Record<string, ChangeStatus> = {
  A: 'added', M: 'modified', D: 'deleted', R: 'renamed', C: 'copied',
};

/** Parse Git --name-status output, including rename/copy records. */
export function parseNameStatusDiff(output: string): ChangedFile[] {
  return output.split(/\r?\n/).map(line => line.trim()).filter(Boolean).flatMap(line => {
    const parts = line.split('\t');
    const statusToken = parts[0] ?? '';
    const status = statusMap[statusToken[0] ?? ''] ?? 'unknown';
    if ((status === 'renamed' || status === 'copied') && parts.length >= 3) {
      return [{ status, previousPath: parts[1], path: parts[2] }];
    }
    if (parts.length >= 2) return [{ status, path: parts.slice(1).join('\t') }];
    return [];
  });
}

function suiteForFile(file: string): string[] {
  const p = file.replaceAll('\\', '/');
  const suites: string[] = [];
  if (/^(android|app|.*\.gradle(\.kts)?|gradle\.properties|settings\.gradle(\.kts)?)$/.test(p) ||
      /(^|\/)(build\.gradle(\.kts)?|settings\.gradle(\.kts)?|gradle\.properties)$/.test(p)) suites.push('android-build-smoke');
  if (/\.(kt|java)$/.test(p) || /(^|\/)src\/(main|test|androidTest)\//.test(p)) suites.push('android-unit-and-instrumentation');
  if (/\.dart$/.test(p) || /(^|\/)pubspec\.yaml$/.test(p) || /(^|\/)lib\//.test(p)) suites.push('flutter-test-and-analyze');
  if (/(^|\/)(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|tsconfig\.json)$/.test(p)) suites.push('tooling-regression');
  if (/^\.github\//.test(p) || /(^|\/)(gradle|scripts)\//.test(p)) suites.push('build-and-ci-regression');
  if (/\.(xml|json|ya?ml|properties)$/.test(p) && suites.length === 0) suites.push('configuration-review');
  return suites;
}

/**
 * Uses Git diff as a conservative selector. A broad fallback is recommended
 * whenever no reliable test mapping can be inferred.
 */
export function analyzeChangedFiles(changedFiles: ChangedFile[], base = 'HEAD~1', head = 'WORKTREE'): ImpactAnalysis {
  const selected = new Set<string>();
  const rationale: string[] = [];
  for (const file of changedFiles) {
    const mapped = new Set([...suiteForFile(file.path), ...(file.previousPath ? suiteForFile(file.previousPath) : [])]);
    if (mapped.size === 0) rationale.push(`No confident test mapping for ${file.path}; include broad regression coverage.`);
    else rationale.push(`${file.path}: selected ${[...mapped].join(', ')} based on path and file type.`);
    for (const suite of mapped) selected.add(suite);
  }
  const fallbackToBroadRun = changedFiles.length === 0 || rationale.some(item => item.startsWith('No confident'));
  if (changedFiles.length === 0) rationale.push('No changed files were supplied; run broad discovery/regression rather than assuming nothing is affected.');
  if (fallbackToBroadRun) selected.add('broad-regression');
  return { base, head, changedFiles, selectedSuites: [...selected].sort(), fallbackToBroadRun, rationale };
}

export async function collectGitChanges(cwd: string, base = 'HEAD~1'): Promise<ImpactAnalysis> {
  const root = path.resolve(cwd);
  try {
    const { stdout } = await execFileAsync('git', ['diff', '--name-status', '--find-renames', `${base}...HEAD`], { cwd: root, maxBuffer: 2 * 1024 * 1024 });
    const { stdout: workingTree } = await execFileAsync('git', ['status', '--short', '--untracked-files=all'], { cwd: root, maxBuffer: 2 * 1024 * 1024 });
    const committed = parseNameStatusDiff(stdout);
    const uncommitted = workingTree.split(/\r?\n/).filter(Boolean).map(line => {
      const code = line.slice(0, 2).trim();
      const file = line.slice(3).trim();
      return { status: (code === '??' || code.includes('A')) ? 'added' as const : code.includes('D') ? 'deleted' as const : 'modified' as const, path: file };
    });
    const merged = new Map<string, ChangedFile>();
    for (const file of [...committed, ...uncommitted]) merged.set(file.path, file);
    return analyzeChangedFiles([...merged.values()], base, 'HEAD + WORKTREE');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to analyze Git changes in ${root}. Ensure this is a Git repository and base ref "${base}" exists. Details: ${message}`);
  }
}
