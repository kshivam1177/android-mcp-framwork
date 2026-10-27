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
  return output.split(/\r?\n/).map(line => line.trim()).filter(Boolean).flatMap<ChangedFile>((line): ChangedFile[] => {
    const parts = line.split('\t');
    const statusToken = parts[0] ?? '';
    const status = statusMap[statusToken[0] ?? ''] ?? 'unknown';
    if ((status === 'renamed' || status === 'copied') && parts.length >= 3) {
      const previousPath = parts[1];
      const path = parts[2];
      if (previousPath !== undefined && path !== undefined) return [{ status, previousPath, path }];
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

export interface StoredTestCase {
  id?: string;
  title?: string;
  description?: string;
  category?: string;
  relatedFiles?: string[];
  affectedPaths?: string[];
  sourceFiles?: string[];
  files?: string[];
  paths?: string[];
  modules?: string[];
  tags?: string[];
  [key: string]: unknown;
}
export interface TestCaseImpact {
  id: string;
  title: string;
  category: string;
  file?: string;
  matchedPaths: string[];
  rationale: string;
}
export interface TestCaseImpactResult {
  selectedTestCases: TestCaseImpact[];
  unmappedChangedFiles: string[];
  testCaseMappingAvailable: boolean;
  requiresBroadRegression: boolean;
  rationale: string[];
}

function declaredPaths(testCase: StoredTestCase): string[] {
  const keys = ['relatedFiles', 'affectedPaths', 'sourceFiles', 'files', 'paths', 'modules'] as const;
  const values: string[] = [];
  for (const key of keys) {
    const raw = testCase[key];
    if (Array.isArray(raw)) values.push(...raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0));
    else if (typeof raw === 'string' && raw.trim()) values.push(raw);
  }
  return [...new Set(values.map(value => value.replaceAll('\\\\', '/').replace(/^\.\//, '').trim()))];
}

function pathMatches(changedPath: string, declaredPattern: string): boolean {
  const changed = changedPath.replaceAll('\\\\', '/').replace(/^\.\//, '');
  const pattern = declaredPattern.replaceAll('\\\\', '/').replace(/^\.\//, '');
  if (!pattern || pattern === '*') return false;
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3).replace(/\/$/, '');
    return changed === prefix || changed.startsWith(prefix + '/');
  }
  if (pattern.endsWith('*')) return changed.startsWith(pattern.slice(0, -1));
  return changed === pattern || changed.startsWith(pattern.endsWith('/') ? pattern : pattern + '/');
}

/**
 * Match saved test cases only when they declare a file/module relationship.
 * Name/category similarity is deliberately not treated as proof of coverage.
 */
export function analyzeTestCaseImpact(changedFiles: ChangedFile[], testCases: StoredTestCase[]): TestCaseImpactResult {
  const selectedTestCases: TestCaseImpact[] = [];
  const mappedPaths = new Set<string>();
  const rationale: string[] = [];
  for (const testCase of testCases) {
    const paths = declaredPaths(testCase);
    if (!paths.length) continue;
    const matchedPaths = changedFiles
      .map(file => file.path)
      .filter(file => paths.some(pattern => pathMatches(file, pattern)));
    if (!matchedPaths.length) continue;
    matchedPaths.forEach(file => mappedPaths.add(file));
    const id = typeof testCase.id === 'string' && testCase.id.trim()
      ? testCase.id.trim()
      : typeof testCase.title === 'string' && testCase.title.trim()
        ? testCase.title.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 80)
        : 'unnamed-test-case';
    const title = typeof testCase.title === 'string' && testCase.title.trim() ? testCase.title.trim() : id;
    const category = typeof testCase.category === 'string' && testCase.category.trim() ? testCase.category.trim() : 'general';
    selectedTestCases.push({
      id,
      title,
      category,
      ...(typeof testCase.file === 'string' ? { file: testCase.file } : {}),
      matchedPaths,
      rationale: `Explicit test-case mapping matched: ${matchedPaths.join(', ')}.`,
    });
  }
  const unmappedChangedFiles = changedFiles.map(file => file.path).filter(file => !mappedPaths.has(file));
  const testCaseMappingAvailable = testCases.some(testCase => declaredPaths(testCase).length > 0);
  const requiresBroadRegression = changedFiles.length === 0 || (testCases.length > 0 && selectedTestCases.length === 0) || unmappedChangedFiles.length > 0;
  if (!testCases.length) rationale.push('No saved test cases were found; suite recommendations are not a substitute for project-specific coverage.');
  else if (!testCaseMappingAvailable) rationale.push('Saved test cases do not declare relatedFiles, affectedPaths, sourceFiles, files, paths, or modules. No test case was assumed to cover the changed code.');
  if (selectedTestCases.length) rationale.push(`Selected ${selectedTestCases.length} saved test case(s) using explicit file/module mappings.`);
  if (unmappedChangedFiles.length) rationale.push(`No explicit test-case mapping covers: ${unmappedChangedFiles.join(', ')}.`);
  if (requiresBroadRegression) rationale.push('Run broad regression coverage in addition to any mapped tests; impact analysis cannot prove that unselected areas are unaffected.');
  return {
    selectedTestCases: selectedTestCases.sort((a, b) => a.id.localeCompare(b.id)),
    unmappedChangedFiles,
    testCaseMappingAvailable,
    requiresBroadRegression,
    rationale,
  };
}
