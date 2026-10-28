import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfigDir } from '../../config/loader.js';
import { collectGitChanges, type StoredTestCase } from '../../testing-intelligence/changeImpact.js';
import { buildIntelligentPlan, type PriorFailure } from '../../testing-intelligence/intelligentPlanning.js';
import { redactDiagnosticText } from '../../testing-intelligence/runtimeSafety.js';
import { resolveProjectRoot } from '../../utils/paths.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import type { ToolModule } from '../types.js';

export const toolName = 'plan_change_aware_test_run';
export const workflow = 'testing-intelligence';

type CoverageIdea = {
  changedPath: string;
  suggestedTestType: string;
  rationale: string;
  status: 'candidate-needs-review';
  execution: 'not-executed';
};

export function suggestCoverageIdeas(paths: string[]): CoverageIdea[] {
  return [...new Set(paths)].sort().map((changedPath) => {
    const normalized = changedPath.replaceAll('\\\\', '/');
    let suggestedTestType = 'manual-review-and-broad-regression';
    let rationale = 'No safe test type can be inferred from the path alone; inspect the changed code and add an explicit saved test mapping.';
    if (/\.dart$/i.test(normalized)) {
      suggestedTestType = /(^|\/)test\//.test(normalized) ? 'flutter-test-maintenance' : 'flutter-unit-or-widget-test';
      rationale = 'Dart source changed without a saved test mapping; inspect public behavior and add a focused Flutter test.';
    } else if (/\.(kt|java)$/i.test(normalized)) {
      suggestedTestType = /androidTest/i.test(normalized) ? 'android-instrumentation-test' : /(^|\/)test\//i.test(normalized) ? 'android-unit-test' : 'android-unit-or-instrumentation-test';
      rationale = 'Android source changed without a saved test mapping; choose a JVM unit test or device-backed test based on platform dependencies.';
    } else if (/\.(tsx?|jsx?)$/i.test(normalized)) {
      suggestedTestType = 'javascript-unit-or-component-test';
      rationale = 'JavaScript/TypeScript source changed without a saved test mapping; add a focused unit/component test appropriate to the module.';
    } else if (/(^|\/)(build\.gradle(\.kts)?|settings\.gradle(\.kts)?|gradle\.properties|pubspec\.yaml|package\.json|package-lock\.json|tsconfig\.json)$/.test(normalized)) {
      suggestedTestType = 'build-and-toolchain-smoke';
      rationale = 'Build/dependency configuration changed; validate dependency resolution and a minimal build before app-level regression.';
    } else if (/\.xml$/i.test(normalized)) {
      suggestedTestType = 'android-resource-or-layout-test';
      rationale = 'Android XML/resource changed; validate resource compilation and the affected screen on an emulator or device.';
    }
    return { changedPath, suggestedTestType, rationale, status: 'candidate-needs-review', execution: 'not-executed' };
  });
}

async function readJson(file: string): Promise<Record<string, unknown> | undefined> {
  try {
    const value: unknown = JSON.parse(await fs.readFile(file, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  } catch { return undefined; }
}

async function readTestCases(directory: string): Promise<{ cases: StoredTestCase[]; warnings: string[] }> {
  const cases: StoredTestCase[] = [];
  const warnings: string[] = [];
  let files: string[];
  try { files = (await fs.readdir(directory)).filter((name) => name.endsWith('.json')).sort(); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { cases, warnings: ['No saved test-case directory exists yet.'] };
    throw error;
  }
  for (const filename of files) {
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(path.join(directory, filename), 'utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) cases.push({ ...(parsed as StoredTestCase), file: path.relative(path.dirname(directory), path.join(directory, filename)).split(path.sep).join('/') });
      else warnings.push('Ignored non-object test case: ' + filename);
    } catch { warnings.push('Ignored invalid JSON test case: ' + filename); }
  }
  return { cases, warnings };
}

async function readRecentFailures(reportRoot: string, limit: number): Promise<PriorFailure[]> {
  const failures: PriorFailure[] = [];
  let dates: string[];
  try { dates = (await fs.readdir(reportRoot)).filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name)).sort().reverse(); }
  catch { return failures; }
  for (const date of dates) {
    const dateRoot = path.join(reportRoot, date);
    const times = (await fs.readdir(dateRoot).catch(() => [] as string[])).sort().reverse();
    for (const time of times) {
      const summary = await readJson(path.join(dateRoot, time, 'summary.json'));
      if (!summary || !Array.isArray(summary.work)) continue;
      for (const item of summary.work as Array<Record<string, unknown>>) {
        if (!['failed', 'blocked', 'incomplete'].includes(String(item.status))) continue;
        failures.push({
          ...(typeof item.id === 'string' ? { testCaseId: item.id } : {}),
          ...(typeof item.name === 'string' ? { title: item.name } : {}),
          ...(typeof item.error === 'string' ? { error: redactDiagnosticText(item.error).slice(0, 1200) } : {}),
          status: String(item.status),
        });
        if (failures.length >= limit) return failures;
      }
    }
  }
  return failures;
}

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Plan Change-Aware Autonomous Tests',
    description: 'Build a reviewable, change-aware test plan from Git diffs, explicit saved-test mappings, project instructions, and recent failures. Identifies unmapped code and proposes test types for human review. Read-only: never writes test cases, launches apps, or executes tests.',
    inputSchema: {
      request: z.string().min(3).max(4000).optional().default('Validate behavior affected by the current code changes'),
      projectPath: z.string().optional(),
      base: z.string().optional().default('HEAD~1').describe('Git base ref for change analysis.'),
      maxTestCases: z.number().int().min(1).max(30).optional().default(10),
      maxPriorFailures: z.number().int().min(0).max(100).optional().default(30),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, withErrorHandling(async (args: { request?: string; projectPath?: string; base?: string; maxTestCases?: number; maxPriorFailures?: number }) => {
    const projectRoot = resolveProjectRoot(path.resolve(args.projectPath ?? process.cwd()));
    const configDir = getConfigDir(projectRoot);
    const warnings: string[] = [];
    let impact;
    try { impact = await collectGitChanges(projectRoot, args.base ?? 'HEAD~1'); }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error('Cannot produce a trustworthy change-aware plan: ' + redactDiagnosticText(message));
    }
    const loaded = await readTestCases(path.join(configDir, 'testcases'));
    warnings.push(...loaded.warnings);
    const priorFailures = await readRecentFailures(path.join(configDir, 'test-reports'), args.maxPriorFailures ?? 30);
    const instructionLines: string[] = [];
    const instructionDir = path.join(configDir, 'instructions');
    const instructionFiles = (await fs.readdir(instructionDir).catch(() => [] as string[])).filter((name) => name.endsWith('.md')).sort();
    for (const filename of instructionFiles) {
      const content = await fs.readFile(path.join(instructionDir, filename), 'utf8').catch(() => '');
      if (content) instructionLines.push('# ' + filename + '\n' + content.slice(0, 12000));
    }
    const plan = buildIntelligentPlan({
      request: args.request ?? 'Validate behavior affected by the current code changes',
      changedFiles: impact.changedFiles,
      testCases: loaded.cases,
      instructions: instructionLines,
      priorFailures,
      maxTestCases: args.maxTestCases ?? 10,
    });
    const candidateCoverageIdeas = suggestCoverageIdeas(plan.unmappedChangedFiles);
    const result = {
      schemaVersion: 1,
      projectRoot,
      base: impact.base,
      head: impact.head,
      status: plan.status,
      selected: plan.selected,
      changedFiles: impact.changedFiles,
      selectedSuites: impact.selectedSuites,
      fallbackToBroadRun: impact.fallbackToBroadRun || plan.broadRegressionRecommended,
      unmappedChangedFiles: plan.unmappedChangedFiles,
      candidateCoverageIdeas,
      relevantInstructions: plan.relevantInstructions,
      recentFailureCount: priorFailures.length,
      relevantPriorFailures: plan.relevantPriorFailures,
      nextActions: plan.nextActions,
      warnings,
      safety: {
        readOnly: true,
        testsExecuted: false,
        testCasesWritten: false,
        candidateIdeasAreExecutable: false,
        approvalRequiredBeforeExecution: true,
      },
    };
    return textResult(JSON.stringify(result, null, 2), result as unknown as Record<string, unknown>);
  }));
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
