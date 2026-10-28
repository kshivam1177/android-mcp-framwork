import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { execCommand } from '../../utils/exec.js';
import { resolveProjectRoot } from '../../utils/paths.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import type { ToolModule } from '../types.js';

export const toolName = 'validate_test_evidence_bundle';
export const workflow = 'testing-intelligence';

type ReportTest = { name: string; status: string };
type ReportSummary = { generatedAt?: string; gitHeadSha?: string; workingTreeClean?: boolean; status?: string; tests?: ReportTest[]; results?: Array<{ suite?: string; status?: string }> };

export interface EvidenceBundleResult {
  decision: 'pass' | 'fail' | 'incomplete';
  currentGitHeadSha: string | null;
  workingTreeClean: boolean | null;
  reportsChecked: number;
  missingRequiredSuites: string[];
  failures: string[];
  warnings: string[];
  reports: Array<{ path: string; decision: 'pass' | 'fail' | 'incomplete'; generatedAt: string | null; ageMinutes: number | null; gitHeadSha: string | null; tests: number; passed: number; failed: number; skipped: number; issues: string[] }>;
}

export function assessEvidenceBundle(input: {
  currentHead: string | null;
  workingTreeClean: boolean | null;
  reports: Array<{ path: string; generatedAt?: string; gitHeadSha?: string; tests: ReportTest[]; maxAgeMinutes: number }>;
  requiredSuites?: string[];
  nowMs?: number;
  requireCleanWorkingTree?: boolean;
}): EvidenceBundleResult {
  const now = input.nowMs ?? Date.now();
  const required = [...new Set(input.requiredSuites ?? [])];
  const seen = new Set<string>();
  const failures: string[] = [];
  const warnings: string[] = [];
  const reports: EvidenceBundleResult['reports'] = input.reports.map(report => {
    const issues: string[] = [];
    const timestamp = report.generatedAt ? Date.parse(report.generatedAt) : NaN;
    const ageMinutes = Number.isFinite(timestamp) ? Math.floor((now - timestamp) / 60000) : null;
    if (ageMinutes === null) issues.push('Missing or invalid generatedAt timestamp.');
    else if (ageMinutes < 0) issues.push('Report timestamp is in the future.');
    else if (ageMinutes > report.maxAgeMinutes) issues.push('Report is stale (' + ageMinutes + ' minutes old).');
    if (!report.gitHeadSha || !/^[a-f0-9]{40,64}$/i.test(report.gitHeadSha)) issues.push('Report has no valid Git HEAD provenance.');
    else if (!input.currentHead) issues.push('Current Git HEAD could not be read.');
    else if (report.gitHeadSha.toLowerCase() !== input.currentHead.toLowerCase()) issues.push('Report Git HEAD does not match current HEAD.');
    const passed = report.tests.filter(test => ['passed', 'pass', 'success', 'succeeded'].includes(test.status.toLowerCase())).length;
    const failed = report.tests.filter(test => ['failed', 'fail', 'failure', 'error'].includes(test.status.toLowerCase())).length;
    const skipped = report.tests.length - passed - failed;
    for (const test of report.tests) seen.add(test.name);
    if (failed) issues.push(failed + ' test outcome(s) failed.');
    if (skipped) issues.push(skipped + ' test outcome(s) are skipped, blocked, or unrecognized.');
    const decision = issues.some(issue => /failed|does not match|future/.test(issue)) ? 'fail' : issues.length ? 'incomplete' : 'pass';
    return { path: report.path, decision, generatedAt: report.generatedAt ?? null, ageMinutes, gitHeadSha: report.gitHeadSha ?? null, tests: report.tests.length, passed, failed, skipped, issues };
  });
  if (input.reports.length === 0) warnings.push('No report files were supplied.');
  const missingRequiredSuites = required.filter(name => !seen.has(name));
  if (missingRequiredSuites.length) warnings.push('Required suite(s) missing from supplied report outcomes: ' + missingRequiredSuites.join(', '));
  if (!input.currentHead) warnings.push('Current Git HEAD is unavailable; provenance cannot be verified.');
  if (input.requireCleanWorkingTree !== false && input.workingTreeClean !== true) warnings.push(input.workingTreeClean === false ? 'Working tree is dirty; commit SHA does not fingerprint uncommitted content.' : 'Working-tree cleanliness could not be verified.');
  for (const report of reports) if (report.decision === 'fail') failures.push(report.path + ': ' + report.issues.join(' '));
  const incomplete = input.reports.length === 0 || missingRequiredSuites.length > 0 || warnings.length > 0 || reports.some(report => report.decision === 'incomplete');
  const fail = failures.length > 0 || reports.some(report => report.decision === 'fail');
  const decision = fail ? 'fail' : incomplete ? 'incomplete' : reports.every(report => report.decision === 'pass') ? 'pass' : 'incomplete';
  return { decision, currentGitHeadSha: input.currentHead, workingTreeClean: input.workingTreeClean, reportsChecked: reports.length, missingRequiredSuites, failures, warnings, reports };
}

async function readGit(root: string, args: string[]): Promise<string | null> {
  try {
    const result = await execCommand('git', args, { cwd: root, timeoutMs: 5000 });
    return result.exitCode === 0 ? result.stdout.trim() : null;
  } catch { return null; }
}

function insideRoot(root: string, candidate: string): string {
  const absolute = path.resolve(root, candidate);
  const relative = path.relative(root, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Report paths must resolve inside the project root.');
  return absolute;
}

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Validate a Multi-Report Test Evidence Bundle',
    description: 'Validate saved report freshness, Git HEAD provenance, working-tree cleanliness, suite coverage, and test outcomes across multiple reports. Returns pass/fail/incomplete; it does not execute tests or change files.',
    inputSchema: {
      projectPath: z.string().optional(),
      reportPaths: z.array(z.string()).min(1).max(100),
      requiredSuites: z.array(z.string().min(1)).optional().default([]),
      maxAgeMinutes: z.number().int().min(1).max(10080).optional().default(1440),
      requireCleanWorkingTree: z.boolean().optional().default(true),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, withErrorHandling(async (args: { projectPath?: string; reportPaths: string[]; requiredSuites?: string[]; maxAgeMinutes?: number; requireCleanWorkingTree?: boolean }) => {
    const root = resolveProjectRoot(path.resolve(args.projectPath ?? process.cwd()));
    const currentHead = await readGit(root, ['rev-parse', 'HEAD']);
    const porcelain = await readGit(root, ['status', '--porcelain']);
    const workingTreeClean = porcelain === null ? null : porcelain.length === 0;
    const reports: Array<{ path: string; generatedAt?: string; gitHeadSha?: string; tests: ReportTest[]; maxAgeMinutes: number }> = [];
    const readIssues: string[] = [];
    for (const candidate of args.reportPaths) {
      const absolute = insideRoot(root, candidate);
      try {
        const raw: unknown = JSON.parse(await fs.readFile(absolute, 'utf8'));
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Report must be a JSON object.');
        const value = raw as ReportSummary;
        const tests: ReportTest[] = [];
        if (Array.isArray(value.tests)) {
          for (const item of value.tests) if (item && typeof item.name === 'string' && typeof item.status === 'string') tests.push({ name: item.name, status: item.status });
        }
        if (Array.isArray(value.results)) {
          for (const item of value.results) if (item && typeof item.suite === 'string' && typeof item.status === 'string' && !tests.some(test => test.name === item.suite)) tests.push({ name: item.suite, status: item.status });
        }
        reports.push({ path: path.relative(root, absolute).split(path.sep).join('/'), generatedAt: value.generatedAt, gitHeadSha: value.gitHeadSha, tests, maxAgeMinutes: args.maxAgeMinutes ?? 1440 });
      } catch (error) {
        readIssues.push(path.relative(root, absolute).split(path.sep).join('/') + ': ' + (error instanceof Error ? error.message : String(error)));
      }
    }
    const result = assessEvidenceBundle({ currentHead, workingTreeClean, reports, requiredSuites: args.requiredSuites, requireCleanWorkingTree: args.requireCleanWorkingTree });
    if (readIssues.length) {
      result.decision = 'incomplete';
      result.warnings.push(...readIssues.map(issue => 'Report could not be loaded: ' + issue));
    }
    const output = { ...result, projectRoot: root, policy: { maxAgeMinutes: args.maxAgeMinutes ?? 1440, requireCleanWorkingTree: args.requireCleanWorkingTree ?? true } };
    return textResult(JSON.stringify(output, null, 2), output as unknown as Record<string, unknown>);
  }));
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
