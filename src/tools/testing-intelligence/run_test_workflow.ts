import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfigDir } from '../../config/loader.js';
import { collectGitChanges, type StoredTestCase } from '../../testing-intelligence/changeImpact.js';
import { planFromRequest } from '../../testing-intelligence/planner.js';
import { resolveTargetAndBackend } from '../ui-automation/_shared.js';
import { findNodesByTarget } from './run_test_case.js';
import { parseUiHierarchy } from '../../automation/uiHierarchy.js';
import { resolveProjectRoot } from '../../utils/paths.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import type { UiNode } from '../../types.js';
import type { ToolModule } from '../types.js';

export const toolName = 'run_test_workflow';
export const workflow = 'testing-intelligence';

type StepResult = {
  stepNumber: number;
  action: string;
  target?: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  durationMs: number;
  error?: string;
  evidence?: string[];
};

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

async function loadTestCases(testCaseDir: string): Promise<StoredTestCase[]> {
  const cases: StoredTestCase[] = [];
  let files: string[];
  try {
    files = (await fs.readdir(testCaseDir)).filter(name => name.endsWith('.json')).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return cases;
    throw error;
  }
  for (const file of files) {
    try {
      const value: unknown = JSON.parse(await fs.readFile(path.join(testCaseDir, file), 'utf8'));
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        cases.push({ ...(value as StoredTestCase), file: path.join(testCaseDir, file) });
      }
    } catch {
      // Ignore malformed cases; the plan will report gaps if no usable case matches.
    }
  }
  return cases;
}

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Run Change-Aware Test Workflow',
    description: 'Plan and optionally execute saved test cases for a natural-language request. Reuses explicit saved steps, supports a plan-only preview, captures screenshot evidence for failed steps, and writes per-case plus aggregate reports. This tool does not invent missing tests or claim skipped work passed.',
    inputSchema: {
      request: z.string().min(3).max(4000).describe('What changed or what behavior should be tested.'),
      projectPath: z.string().optional(),
      base: z.string().optional().describe('Git base ref for change context; defaults to HEAD~1.'),
      targetId: z.string().optional().describe('Android target for execution; required when more than one device is connected.'),
      execute: z.boolean().optional().default(false).describe('Default false: return a reviewable plan only. Set true to execute selected saved cases.'),
      maxTestCases: z.number().int().min(1).max(30).optional().default(10),
      stopOnFailure: z.boolean().optional().default(false),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, withErrorHandling(async (args: {
    request: string;
    projectPath?: string;
    base?: string;
    targetId?: string;
    execute?: boolean;
    maxTestCases?: number;
    stopOnFailure?: boolean;
  }) => {
    const root = resolveProjectRoot(path.resolve(args.projectPath ?? process.cwd()));
    const configDir = getConfigDir(root);
    const testCases = await loadTestCases(path.join(configDir, 'testcases'));
    let changedFiles: Array<{ status: 'added'|'modified'|'deleted'|'renamed'|'copied'|'unknown'; path: string; previousPath?: string }> = [];
    const warnings: string[] = [];
    try {
      changedFiles = (await collectGitChanges(root, args.base ?? 'HEAD~1')).changedFiles;
    } catch (error) {
      warnings.push('Git change context unavailable: ' + (error instanceof Error ? error.message : String(error)));
    }
    const plan = planFromRequest({
      request: args.request,
      changedFiles,
      testCases,
      maxTestCases: args.maxTestCases,
    });
    if (!args.execute) {
      const result = {
        mode: 'plan-only',
        status: plan.status,
        plan,
        warnings,
        nextStep: 'Review the selected saved test cases, then rerun with execute=true to perform device actions.',
      };
      return textResult(JSON.stringify(result, null, 2), result);
    }
    if (!plan.selectedTestCases.length) {
      const result = { mode: 'execute', status: 'blocked', reason: 'No saved test cases matched the request or changed-file mappings.', plan, warnings };
      return textResult(JSON.stringify(result, null, 2), result);
    }

    const { target, backend } = await resolveTargetAndBackend(args.targetId);
    const runId = randomUUID().slice(0, 8);
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toISOString().slice(11, 19).replace(/:/g, '');
    const reportDir = path.join(configDir, 'test-reports', date, time + '-workflow-' + runId);
    const evidenceDir = path.join(reportDir, 'evidence');
    await fs.mkdir(reportDir, { recursive: true });
    const caseResults: Array<{ id: string; title: string; status: 'PASSED'|'FAILED'|'INCOMPLETE'; reportPath: string; passedSteps: number; failedSteps: number }> = [];
    let stop = false;

    for (const selected of plan.selectedTestCases) {
      if (stop) {
        caseResults.push({ id: selected.id, title: selected.title, status: 'INCOMPLETE', reportPath: '', passedSteps: 0, failedSteps: 0 });
        continue;
      }
      const source = testCases.find(item => typeof item.id === 'string' && item.id === selected.id);
      if (!source || !Array.isArray(source.steps) || source.steps.length === 0) {
        caseResults.push({ id: selected.id, title: selected.title, status: 'INCOMPLETE', reportPath: '', passedSteps: 0, failedSteps: 0 });
        warnings.push('Test case ' + selected.id + ' has no executable saved steps.');
        continue;
      }
      const stepResults: StepResult[] = [];
      for (let i = 0; i < source.steps.length; i++) {
        const raw = source.steps[i] as Record<string, unknown>;
        const action = typeof raw.action === 'string' ? raw.action.toLowerCase() : 'tap';
        const targetText = typeof raw.target === 'string' ? raw.target : '';
        const description = typeof raw.description === 'string' ? raw.description : 'Step ' + (i + 1);
        const started = Date.now();
        try {
          if (action === 'wait_for_ui') {
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else if (action === 'key_press' || action === 'button') {
            const key = typeof raw.key === 'string' ? raw.key : '4';
            await backend.keyEvent(target.id, key);
          } else if (action === 'type_text') {
            const textToType = typeof raw.text === 'string' ? raw.text : typeof raw.value === 'string' ? raw.value : '';
            if (targetText.trim()) {
              const nodes = parseUiHierarchy(await backend.dumpHierarchy(target.id));
              const matches = findNodesByTarget(nodes, targetText);
              if (matches.length !== 1) throw new Error(matches.length ? 'Ambiguous target "' + targetText + '" matched ' + matches.length + ' elements.' : 'Could not locate target "' + targetText + '".');
              await backend.tap(target.id, matches[0]!.centerX, matches[0]!.centerY);
            }
            if (!textToType) throw new Error('type_text step has no saved text/value.');
            await backend.typeText(target.id, textToType);
          } else if (action === 'tap') {
            const coords = targetText.match(/^\s*\(?\s*(\d+)\s*,\s*(\d+)\s*\)?\s*$/);
            if (coords) await backend.tap(target.id, Number(coords[1]), Number(coords[2]));
            else {
              const nodes: UiNode[] = parseUiHierarchy(await backend.dumpHierarchy(target.id));
              const matches = findNodesByTarget(nodes, targetText || description);
              if (matches.length !== 1) throw new Error(matches.length ? 'Ambiguous target "' + (targetText || description) + '" matched ' + matches.length + ' elements.' : 'Could not locate target "' + (targetText || description) + '".');
              await backend.tap(target.id, matches[0]!.centerX, matches[0]!.centerY);
            }
          } else {
            throw new Error('Unsupported action "' + action + '". Supported actions: tap, type_text, key_press, button, wait_for_ui.');
          }
          await new Promise(resolve => setTimeout(resolve, 300));
          stepResults.push({ stepNumber: i + 1, action, target: targetText || description, status: 'PASSED', durationMs: Date.now() - started });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const evidence: string[] = [];
          try {
            await fs.mkdir(evidenceDir, { recursive: true });
            const image = await backend.screenshot(target.id);
            const imagePath = path.join(evidenceDir, slug(selected.id) + '-step-' + (i + 1) + '.png');
            await fs.writeFile(imagePath, image.data);
            evidence.push(path.relative(root, imagePath).split(path.sep).join('/'));
          } catch { /* keep the original step failure */ }
          stepResults.push({ stepNumber: i + 1, action, target: targetText || description, status: 'FAILED', durationMs: Date.now() - started, error: message, evidence });
          if (args.stopOnFailure) break;
        }
      }
      const failed = stepResults.filter(step => step.status === 'FAILED').length;
      const passed = stepResults.filter(step => step.status === 'PASSED').length;
      const status = failed ? 'FAILED' : stepResults.length === source.steps.length ? 'PASSED' : 'INCOMPLETE';
      const caseReport = path.join(reportDir, slug(selected.id) + '.json');
      await fs.writeFile(caseReport, JSON.stringify({
        testCaseId: selected.id, title: selected.title, status, target: { id: target.id, model: target.model },
        executedAt: new Date().toISOString(), durationMs: stepResults.reduce((sum, step) => sum + step.durationMs, 0), stepResults,
      }, null, 2) + '\n', 'utf8');
      caseResults.push({ id: selected.id, title: selected.title, status, reportPath: path.relative(root, caseReport).split(path.sep).join('/'), passedSteps: passed, failedSteps: failed });
      if (failed && args.stopOnFailure) stop = true;
    }
    const failedCount = caseResults.filter(item => item.status === 'FAILED').length;
    const incompleteCount = caseResults.filter(item => item.status === 'INCOMPLETE').length;
    const overall = failedCount ? 'failed' : incompleteCount ? 'incomplete' : 'passed';
    const summary = {
      schemaVersion: 1, mode: 'execute', status: overall, request: args.request, target: { id: target.id, model: target.model },
      runId, executedAt: now.toISOString(), selectedCount: plan.selectedTestCases.length,
      passed: caseResults.filter(item => item.status === 'PASSED').length, failed: failedCount, incomplete: incompleteCount,
      results: caseResults, warnings, coverageGaps: plan.missingCoverage,
    };
    const summaryJson = path.join(reportDir, 'summary.json');
    const summaryMd = path.join(reportDir, 'summary.md');
    await fs.writeFile(summaryJson, JSON.stringify(summary, null, 2) + '\n', 'utf8');
    await fs.writeFile(summaryMd, [
      '# Change-Aware Test Workflow', '', '- **Status:** ' + overall.toUpperCase(),
      '- **Request:** ' + args.request, '- **Device:** ' + target.id, '- **Selected cases:** ' + summary.selectedCount,
      '- **Passed:** ' + summary.passed, '- **Failed:** ' + summary.failed, '- **Incomplete:** ' + summary.incomplete, '',
      '## Test cases', ...caseResults.map(item => '- **' + item.status + '** ' + item.id + ' — ' + item.title + (item.reportPath ? ' (' + item.reportPath + ')' : '')),
      '', '## Coverage gaps', ...(plan.missingCoverage.length ? plan.missingCoverage.map(item => '- ' + item) : ['- None reported by the planner.']),
      '', '## Warnings', ...(warnings.length ? warnings.map(item => '- ' + item) : ['- None']), '',
    ].join('\n'), 'utf8');
    const result = { ...summary, summaryJson: path.relative(root, summaryJson).split(path.sep).join('/'), summaryMarkdown: path.relative(root, summaryMd).split(path.sep).join('/') };
    return textResult(JSON.stringify(result, null, 2), result);
  }));
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
