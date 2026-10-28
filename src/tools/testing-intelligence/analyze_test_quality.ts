import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfigDir } from '../../config/loader.js';
import { normalizeReport, type ConsolidatedStatus } from '../../testing-intelligence/reportConsolidation.js';
import { collectGitChanges } from '../../testing-intelligence/changeImpact.js';
import { resolveProjectRoot } from '../../utils/paths.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import type { ToolModule } from '../types.js';

export const toolName = 'analyze_test_quality';
export const workflow = 'testing-intelligence';

type LcovFile = { file: string; found: number; hit: number; uncoveredLines: number[] };
type HistoryEntry = { name: string; status: ConsolidatedStatus; report: string };

function insideRoot(root: string, candidate: string): string {
  const absolute = path.resolve(root, candidate);
  const relative = path.relative(root, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('All report and coverage paths must resolve inside the project root.');
  return absolute;
}

export function parseLcov(input: string): LcovFile[] {
  const files: LcovFile[] = [];
  let current: { file: string; found: number; hit: number; uncoveredLines: number[] } | undefined;
  const finish = () => { if (current) files.push(current); current = undefined; };
  for (const raw of input.split(/\r?\n/)) {
    if (raw.startsWith('SF:')) {
      finish();
      current = { file: raw.slice(3).trim(), found: 0, hit: 0, uncoveredLines: [] };
    } else if (current && raw.startsWith('LF:')) {
      const value = Number(raw.slice(3));
      if (Number.isFinite(value) && value >= 0) current.found = value;
    } else if (current && raw.startsWith('LH:')) {
      const value = Number(raw.slice(3));
      if (Number.isFinite(value) && value >= 0) current.hit = value;
    } else if (current && raw.startsWith('DA:')) {
      const [lineText, countText] = raw.slice(3).split(',');
      const line = Number(lineText);
      const count = Number(countText);
      if (Number.isInteger(line) && line > 0 && Number.isFinite(count) && count === 0) current.uncoveredLines.push(line);
    } else if (raw === 'end_of_record') finish();
  }
  finish();
  return files;
}

export function identifyFlakyTests(entries: HistoryEntry[]): Array<{ name: string; passes: number; failures: number; reports: string[] }> {
  const byName = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const key = entry.name.trim();
    if (!key) continue;
    const list = byName.get(key) ?? [];
    list.push(entry);
    byName.set(key, list);
  }
  return [...byName.entries()].flatMap(([name, rows]) => {
    const passes = rows.filter(row => row.status === 'passed').length;
    const failures = rows.filter(row => row.status === 'failed').length;
    if (passes === 0 || failures === 0) return [];
    return [{ name, passes, failures, reports: [...new Set(rows.map(row => row.report))] }];
  }).sort((a, b) => (b.failures + b.passes) - (a.failures + a.passes) || a.name.localeCompare(b.name));
}

async function exists(file: string): Promise<boolean> {
  try { await fs.access(file); return true; } catch { return false; }
}

async function findReportFiles(root: string, maxFiles: number): Promise<string[]> {
  const found: string[] = [];
  const accepted = new Set(['report.json', 'results.json', 'workflow-report.json', 'replay-report.json']);
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 7 || found.length >= maxFiles) return;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (found.length >= maxFiles) break;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full, depth + 1);
      else if (entry.isFile() && accepted.has(entry.name)) found.push(full);
    }
  }
  await walk(root, 0);
  return found;
}

function statusOf(value: unknown): ConsolidatedStatus | null {
  const s = String(value ?? '').toLowerCase();
  if (['passed', 'pass', 'success', 'succeeded'].includes(s)) return 'passed';
  if (['failed', 'fail', 'failure', 'error'].includes(s)) return 'failed';
  if (['skipped', 'blocked', 'planned', 'generated', 'executed', 'unknown'].includes(s)) return 'skipped';
  return null;
}

export function compareTestOutcomes(previous: Array<{ name: string; status: ConsolidatedStatus }>, current: Array<{ name: string; status: ConsolidatedStatus }>) {
  const before = new Map(previous.map(item => [item.name, item.status]));
  const after = new Map(current.map(item => [item.name, item.status]));
  const regressions: string[] = [];
  const improvements: string[] = [];
  const newTests: string[] = [];
  for (const [name, status] of after) {
    const old = before.get(name);
    if (old === undefined) newTests.push(name);
    else if (old === 'passed' && status === 'failed') regressions.push(name);
    else if (old === 'failed' && status === 'passed') improvements.push(name);
  }
  return { regressions: regressions.sort(), improvements: improvements.sort(), newTests: newTests.sort(), removedTests: [...before.keys()].filter(name => !after.has(name)).sort() };
}

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Analyze Test Quality, Coverage, and History',
    description: 'Build a read-only quality picture from project test markers, LCOV coverage, recent saved reports, and optional baseline/current summaries. Reports coverage as unknown when no coverage file exists; flags flaky tests only when both explicit pass and fail outcomes are observed. Does not execute tests.',
    inputSchema: {
      projectPath: z.string().optional(),
      base: z.string().optional().describe('Git base ref for changed-file coverage analysis; defaults to HEAD~1.'),
      coveragePath: z.string().optional().default('coverage/lcov.info'),
      baselineReportPath: z.string().optional().describe('Optional prior consolidated summary.json, relative to project root.'),
      currentReportPath: z.string().optional().describe('Optional current consolidated summary.json, relative to project root.'),
      maxHistoryReports: z.number().int().min(1).max(500).optional().default(100),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, withErrorHandling(async (args: { projectPath?: string; base?: string; coveragePath?: string; baselineReportPath?: string; currentReportPath?: string; maxHistoryReports?: number }) => {
    const root = resolveProjectRoot(path.resolve(args.projectPath ?? process.cwd()));
    const configDir = getConfigDir(root);
    const warnings: string[] = [];
    const matrix: Array<{ suite: string; available: boolean; evidence: string }> = [];
    const flutter = await exists(path.join(root, 'pubspec.yaml'));
    const gradle = await exists(path.join(root, 'settings.gradle')) || await exists(path.join(root, 'settings.gradle.kts')) || await exists(path.join(root, 'build.gradle')) || await exists(path.join(root, 'build.gradle.kts'));
    if (flutter) {
      matrix.push({ suite: 'flutter-unit-widget', available: await exists(path.join(root, 'test')), evidence: 'Flutter pubspec.yaml and test/ directory' });
      matrix.push({ suite: 'flutter-device-integration', available: await exists(path.join(root, 'integration_test')), evidence: 'Flutter integration_test/ directory' });
    }
    if (gradle) {
      matrix.push({ suite: 'android-gradle-unit', available: await exists(path.join(root, 'app', 'src', 'test')) || await exists(path.join(root, 'src', 'test')), evidence: 'Gradle project markers and conventional unit-test source directories' });
      matrix.push({ suite: 'android-gradle-instrumented', available: await exists(path.join(root, 'app', 'src', 'androidTest')) || await exists(path.join(root, 'src', 'androidTest')), evidence: 'Conventional androidTest source directories' });
    }
    if (!flutter && !gradle) warnings.push('No root Flutter or Gradle project marker detected; pass a more specific projectPath for a monorepo.');

    let changedFiles: string[] = [];
    try {
      const changes = await collectGitChanges(root, args.base ?? 'HEAD~1');
      changedFiles = changes.changedFiles.map(item => item.path);
    } catch (error) {
      warnings.push('Git changed-file analysis unavailable: ' + (error instanceof Error ? error.message : String(error)));
    }

    const coverageFile = insideRoot(root, args.coveragePath ?? 'coverage/lcov.info');
    let coverage: { status: 'available' | 'missing' | 'invalid'; files: number; changedFiles: Array<{ path: string; found: number; hit: number; percent: number | null; uncoveredLines: number[] }>; uncoveredChangedFiles: string[] } = {
      status: 'missing', files: 0, changedFiles: [], uncoveredChangedFiles: [],
    };
    if (await exists(coverageFile)) {
      try {
        const parsed = parseLcov(await fs.readFile(coverageFile, 'utf8'));
        const byPath = new Map(parsed.map(item => [item.file.replace(/\\/g, '/').replace(/^\.\//, ''), item]));
        const changedCoverage = changedFiles.map(changed => {
          const normalized = changed.replace(/\\/g, '/').replace(/^\.\//, '');
          const row = byPath.get(normalized) ?? parsed.find(item => item.file.endsWith('/' + normalized) || normalized.endsWith('/' + item.file));
          return row ? { path: changed, found: row.found, hit: row.hit, percent: row.found > 0 ? Math.round(row.hit / row.found * 10000) / 100 : null, uncoveredLines: row.uncoveredLines.slice(0, 200) } : { path: changed, found: 0, hit: 0, percent: null, uncoveredLines: [] };
        });
        coverage = { status: 'available', files: parsed.length, changedFiles: changedCoverage, uncoveredChangedFiles: changedCoverage.filter(item => item.percent !== null && item.percent < 100).map(item => item.path) };
        if (changedCoverage.some(item => item.percent === null)) warnings.push('Some changed files have no matching LCOV record; their coverage is unknown, not zero.');
      } catch (error) {
        coverage.status = 'invalid';
        warnings.push('Coverage file could not be parsed: ' + (error instanceof Error ? error.message : String(error)));
      }
    } else warnings.push('Coverage data not found at ' + path.relative(root, coverageFile) + '; coverage is unknown, not zero.');

    const historyRoot = path.join(configDir, 'test-reports');
    const reportFiles = await findReportFiles(historyRoot, args.maxHistoryReports ?? 100);
    const history: HistoryEntry[] = [];
    for (const file of reportFiles) {
      try {
        const raw: unknown = JSON.parse(await fs.readFile(file, 'utf8'));
        const normalized = normalizeReport(path.relative(root, file).split(path.sep).join('/'), raw);
        for (const item of normalized) history.push({ name: item.name, status: item.status, report: item.sourceReport });
      } catch { warnings.push('Unreadable historical report ignored: ' + path.relative(root, file)); }
    }
    const flakyTests = identifyFlakyTests(history);

    let comparison: ReturnType<typeof compareTestOutcomes> | null = null;
    if (args.baselineReportPath && args.currentReportPath) {
      const loadSummary = async (candidate: string) => {
        const file = insideRoot(root, candidate);
        const raw: unknown = JSON.parse(await fs.readFile(file, 'utf8'));
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Summary must be a JSON object: ' + candidate);
        const obj = raw as Record<string, unknown>;
        const tests = Array.isArray(obj.tests) ? obj.tests.flatMap(item => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
          const row = item as Record<string, unknown>;
          const status = statusOf(row.status);
          return typeof row.name === 'string' && status ? [{ name: row.name, status }] : [];
        }) : [];
        return tests;
      };
      comparison = compareTestOutcomes(await loadSummary(args.baselineReportPath), await loadSummary(args.currentReportPath));
    } else if (args.baselineReportPath || args.currentReportPath) warnings.push('Supply both baselineReportPath and currentReportPath to compare regressions.');

    const result = {
      status: warnings.length ? 'analyzed-with-warnings' : 'analyzed',
      projectRoot: root,
      testMatrix: matrix,
      changedFiles,
      coverage,
      history: { reportsScanned: reportFiles.length, outcomesAnalyzed: history.length, flakyTests },
      comparison,
      warnings,
      limitations: [
        'This tool is read-only and never executes a test suite.',
        'Coverage is reported only from an existing LCOV file; missing coverage is unknown, not zero.',
        'Flaky classification requires explicit pass and fail outcomes for the same normalized test name across saved reports.',
        'The discovered matrix is a filesystem-based inventory, not proof that a suite is runnable or that device E2E passed.',
      ],
    };
    return textResult(JSON.stringify(result, null, 2), result as unknown as Record<string, unknown>);
  }));
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
