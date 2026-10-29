import path from 'node:path';
import fs from 'node:fs/promises';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfigDir } from '../../config/loader.js';
import { analyzeTestCaseImpact, collectGitChanges, type StoredTestCase } from '../../testing-intelligence/changeImpact.js';
import { resolveProjectRoot } from '../../utils/paths.js';
import { redactDiagnosticText } from '../../testing-intelligence/runtimeSafety.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import type { ToolModule } from '../types.js';

export const toolName = 'prepare_change_aware_execution_plan';
export const workflow = 'testing-intelligence';

async function loadCases(directory: string): Promise<{ cases: StoredTestCase[]; warnings: string[] }> {
  const cases: StoredTestCase[] = [];
  const warnings: string[] = [];
  let files: string[];
  try { files = (await fs.readdir(directory)).filter(file => file.endsWith('.json')).sort(); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { cases, warnings: ['No saved test cases are available.'] };
    throw error;
  }
  for (const filename of files) {
    try {
      const value: unknown = JSON.parse(await fs.readFile(path.join(directory, filename), 'utf8'));
      if (value && typeof value === 'object' && !Array.isArray(value)) cases.push({ ...(value as StoredTestCase), file: path.join(directory, filename) });
      else warnings.push('Ignored non-object test case: ' + filename);
    } catch { warnings.push('Ignored invalid test-case JSON: ' + filename); }
  }
  return { cases, warnings };
}

export function buildExecutionPlan(input: {
  changedFiles: Array<{ status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'unknown'; path: string; previousPath?: string }>;
  testCases: StoredTestCase[];
  platform: 'flutter' | 'android-gradle';
  suites: Array<'unit' | 'integration'>;
  module?: string;
  variant?: string;
  targetId?: string;
}) {
  const impact = analyzeTestCaseImpact(input.changedFiles, input.testCases);
  const broadRegression = input.changedFiles.length === 0 || impact.requiresBroadRegression || impact.selectedTestCases.length === 0;
  const testCaseIds = impact.selectedTestCases.map(testCase => testCase.id);
  const reasons = [
    broadRegression
      ? 'Broad regression is recommended because changed behavior is not fully covered by explicit saved-test mappings.'
      : 'Focused saved tests cover every detected changed path through explicit path mappings.',
    ...(impact.unmappedChangedFiles.map(file => 'Unmapped changed file: ' + file)),
    ...(input.changedFiles.length === 0 ? ['No Git changes were detected; absence of changes is not treated as proof that no tests are needed.'] : []),
  ];
  const runArgs: Record<string, unknown> = {
    platform: input.platform,
    suites: input.suites,
    includeSavedUiTests: true,
    ...(input.module ? { module: input.module } : {}),
    ...(input.variant ? { variant: input.variant } : {}),
    ...(input.targetId ? { targetId: input.targetId } : {}),
    ...(!broadRegression && testCaseIds.length ? { testCaseIds } : {}),
    execute: true,
  };
  return {
    schemaVersion: 1,
    status: 'prepared-not-executed',
    changedFiles: input.changedFiles,
    selectedTestCases: impact.selectedTestCases,
    selectedTestCaseIds: testCaseIds,
    unmappedChangedFiles: impact.unmappedChangedFiles,
    broadRegressionRecommended: broadRegression,
    rationale: reasons,
    execution: {
      tool: 'run_unified_test_run',
      args: runArgs,
      requiresExplicitAgentOrUserInvocation: true,
      started: false,
      runId: null,
    },
    coverageClaims: {
      mappedChangedFiles: input.changedFiles.length - impact.unmappedChangedFiles.length,
      totalChangedFiles: input.changedFiles.length,
      generatedCandidatesCountedAsCoverage: 0,
      executionResultsAvailable: false,
    },
    safetyNotes: [
      'This tool only prepares a plan; it does not execute tests or acquire a device.',
      'The returned execution arguments must be reviewed before calling run_unified_test_run.',
      'The unified runner remains responsible for preflight, locking, manifests, bounded retry, resumability, evidence and final gates.',
    ],
  };
}

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Prepare a Change-Aware Unified Test Execution Plan',
    description: 'Connect Git change analysis and explicit saved-test mappings to the existing unified test runner. Produces a reviewable invocation with focused test IDs when mappings are complete, otherwise recommends broad regression. Read-only and never executes tests.',
    inputSchema: {
      projectPath: z.string().optional(),
      base: z.string().optional().default('HEAD~1'),
      platform: z.enum(['flutter', 'android-gradle']).optional(),
      suites: z.array(z.enum(['unit', 'integration'])).min(1).max(2).optional().default(['unit']),
      module: z.string().optional(),
      variant: z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/).optional(),
      targetId: z.string().optional(),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, withErrorHandling(async (args: {
    projectPath?: string; base?: string; platform?: 'flutter' | 'android-gradle';
    suites?: Array<'unit' | 'integration'>; module?: string; variant?: string; targetId?: string;
  }) => {
    const root = resolveProjectRoot(path.resolve(args.projectPath ?? process.cwd()));
    let changes;
    try { changes = await collectGitChanges(root, args.base ?? 'HEAD~1'); }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error('Cannot prepare a trustworthy execution plan: ' + redactDiagnosticText(message));
    }
    const loaded = await loadCases(path.join(getConfigDir(root), 'testcases'));
    const plan = buildExecutionPlan({
      changedFiles: changes.changedFiles,
      testCases: loaded.cases,
      platform: args.platform ?? 'android-gradle',
      suites: args.suites ?? ['unit'],
      module: args.module,
      variant: args.variant,
      targetId: args.targetId,
    });
    const result = { ...plan, git: { base: changes.base, head: changes.head }, selectedSuites: changes.selectedSuites, warnings: loaded.warnings };
    return textResult(JSON.stringify(result, null, 2), result as unknown as Record<string, unknown>);
  }));
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
