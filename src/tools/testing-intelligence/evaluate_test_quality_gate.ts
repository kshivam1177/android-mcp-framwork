import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { collectGitChanges } from '../../testing-intelligence/changeImpact.js';
import { resolveProjectRoot } from '../../utils/paths.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { parseLcov, compareTestOutcomes } from './analyze_test_quality.js';
import type { ToolModule } from '../types.js';

export const toolName = 'evaluate_test_quality_gate';
export const workflow = 'testing-intelligence';

export interface QualityGateResult {
  decision: 'pass' | 'fail' | 'incomplete';
  reasons: string[];
  coverage: { evaluatedFiles: number; belowThreshold: string[]; missingFiles: string[] };
  regressions: string[];
}

export function evaluateQualityPolicy(input: {
  coverageRows: Array<{ path: string; percent: number | null }>;
  minCoveragePercent?: number;
  regressions?: string[];
  failOnRegression?: boolean;
}): QualityGateResult {
  const reasons: string[] = [];
  const threshold = input.minCoveragePercent;
  const missingFiles = input.coverageRows.filter(row => row.percent === null).map(row => row.path);
  const belowThreshold = threshold === undefined ? [] : input.coverageRows.filter(row => row.percent !== null && row.percent < threshold).map(row => row.path);
  const regressions = input.regressions ?? [];
  if (threshold !== undefined && input.coverageRows.length === 0) reasons.push('No changed-file coverage rows were available to evaluate the configured threshold.');
  if (threshold !== undefined && missingFiles.length) reasons.push(missingFiles.length + ' changed file(s) have unknown coverage.');
  if (belowThreshold.length) reasons.push(belowThreshold.length + ' changed file(s) are below the minimum coverage threshold of ' + threshold + '%.');
  if (regressions.length && input.failOnRegression !== false) reasons.push(regressions.length + ' test regression(s) detected against the baseline.');
  if (threshold !== undefined && input.coverageRows.length === 0 || (threshold !== undefined && missingFiles.length)) {
    return { decision: 'incomplete', reasons, coverage: { evaluatedFiles: input.coverageRows.filter(row => row.percent !== null).length, belowThreshold, missingFiles }, regressions };
  }
  if (belowThreshold.length || (regressions.length && input.failOnRegression !== false)) {
    return { decision: 'fail', reasons, coverage: { evaluatedFiles: input.coverageRows.filter(row => row.percent !== null).length, belowThreshold, missingFiles }, regressions };
  }
  return { decision: 'pass', reasons: ['All configured quality policies passed.'], coverage: { evaluatedFiles: input.coverageRows.filter(row => row.percent !== null).length, belowThreshold, missingFiles }, regressions };
}

function insideRoot(root: string, candidate: string): string {
  const absolute = path.resolve(root, candidate);
  const relative = path.relative(root, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Report paths must resolve inside the project root.');
  return absolute;
}

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Evaluate Test Quality Policy Gate',
    description: 'Evaluate optional changed-file coverage and baseline-regression policies as pass/fail/incomplete. Missing coverage is incomplete rather than a pass. Read-only: this tool does not run tests or change CI configuration.',
    inputSchema: {
      projectPath: z.string().optional(),
      base: z.string().optional().describe('Git base ref for changed-file selection; defaults to HEAD~1.'),
      coveragePath: z.string().optional().default('coverage/lcov.info'),
      minChangedFileCoveragePercent: z.number().min(0).max(100).optional(),
      baselineReportPath: z.string().optional(),
      currentReportPath: z.string().optional(),
      failOnRegression: z.boolean().optional().default(true),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, withErrorHandling(async (args: { projectPath?: string; base?: string; coveragePath?: string; minChangedFileCoveragePercent?: number; baselineReportPath?: string; currentReportPath?: string; failOnRegression?: boolean }) => {
    const root = resolveProjectRoot(path.resolve(args.projectPath ?? process.cwd()));
    const reasons: string[] = [];
    let changed: string[] = [];
    try { changed = (await collectGitChanges(root, args.base ?? 'HEAD~1')).changedFiles.map(item => item.path); }
    catch (error) { reasons.push('Git change context unavailable: ' + (error instanceof Error ? error.message : String(error))); }
    const coverageRows: Array<{ path: string; percent: number | null }> = [];
    if (args.minChangedFileCoveragePercent !== undefined) {
      const coverageFile = insideRoot(root, args.coveragePath ?? 'coverage/lcov.info');
      try {
        const records = parseLcov(await fs.readFile(coverageFile, 'utf8'));
        for (const changedPath of changed) {
          const normalized = changedPath.replace(/\\/g, '/').replace(/^\.\//, '');
          const record = records.find(item => item.file.replace(/\\/g, '/').replace(/^\.\//, '') === normalized || item.file.endsWith('/' + normalized) || normalized.endsWith('/' + item.file));
          coverageRows.push({ path: changedPath, percent: record && record.found > 0 ? Math.round(record.hit / record.found * 10000) / 100 : null });
        }
      } catch (error) {
        reasons.push('Coverage file unavailable or unreadable: ' + (error instanceof Error ? error.message : String(error)));
        for (const changedPath of changed) coverageRows.push({ path: changedPath, percent: null });
      }
    }

    let regressions: string[] = [];
    if (args.baselineReportPath && args.currentReportPath) {
      const load = async (candidate: string) => {
        const value: unknown = JSON.parse(await fs.readFile(insideRoot(root, candidate), 'utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Report must be a JSON object: ' + candidate);
        const tests = (value as Record<string, unknown>).tests;
        if (!Array.isArray(tests)) return [] as Array<{ name: string; status: 'passed' | 'failed' | 'skipped' }>;
        return tests.flatMap(test => {
          if (!test || typeof test !== 'object' || Array.isArray(test)) return [];
          const row = test as Record<string, unknown>;
          if (typeof row.name !== 'string' || !['passed', 'failed', 'skipped'].includes(String(row.status))) return [];
          return [{ name: row.name, status: row.status as 'passed' | 'failed' | 'skipped' }];
        });
      };
      const compared = compareTestOutcomes(await load(args.baselineReportPath), await load(args.currentReportPath));
      regressions = compared.regressions;
    } else if (args.baselineReportPath || args.currentReportPath) {
      reasons.push('Both baselineReportPath and currentReportPath are required for regression gating.');
    }

    const policy = evaluateQualityPolicy({ coverageRows, minCoveragePercent: args.minChangedFileCoveragePercent, regressions, failOnRegression: args.failOnRegression });
    const result = { ...policy, reasons: [...reasons, ...policy.reasons], projectRoot: root, changedFileCount: changed.length, policy: { minChangedFileCoveragePercent: args.minChangedFileCoveragePercent ?? null, failOnRegression: args.failOnRegression ?? true } };
    if (reasons.length && result.decision === 'pass') result.decision = 'incomplete';
    return textResult(JSON.stringify(result, null, 2), result as unknown as Record<string, unknown>);
  }));
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
