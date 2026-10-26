import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { getConfigDir } from '../../config/loader.js';
import { resolveTargetAndBackend } from '../ui-automation/_shared.js';
import { parseUiHierarchy, cacheSnapshot } from '../../automation/uiHierarchy.js';
import { auditScreen, type QaIssue } from '../../automation/qaAuditor.js';
import type { ToolModule } from '../types.js';
import type { UiNode } from '../../types.js';

export const toolName = 'run_test_case';
export const workflow = 'testing-intelligence';

export function extractCoordinates(targetStr?: string): { x: number; y: number } | null {
  if (!targetStr) return null;
  // Match patterns like (x: 526, y: 79) or x: 526, y: 79 or (526, 79) or [526, 79]
  const match = targetStr.match(/x\s*:\s*(\d+)\s*,\s*y\s*:\s*(\d+)/i) ||
                targetStr.match(/\((\d+)\s*,\s*(\d+)\)/) ||
                targetStr.match(/\[(\d+)\s*,\s*(\d+)\]/);
  if (match && match[1] && match[2]) {
    return { x: parseInt(match[1], 10), y: parseInt(match[2], 10) };
  }
  return null;
}

export function findNodeByTarget(nodes: UiNode[], targetStr: string): UiNode | undefined {
  const lower = targetStr.toLowerCase();
  // 1. Exact match on text or contentDesc
  let found = nodes.find(
    (n) => n.text?.toLowerCase() === lower || n.contentDesc?.toLowerCase() === lower
  );
  if (found) return found;

  // 2. Contains match
  found = nodes.find(
    (n) =>
      (n.text && lower.includes(n.text.toLowerCase())) ||
      (n.contentDesc && lower.includes(n.contentDesc.toLowerCase())) ||
      (n.text && n.text.toLowerCase().includes(lower)) ||
      (n.contentDesc && n.contentDesc.toLowerCase().includes(lower))
  );
  return found;
}

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Run Test Case',
      description:
        'Quickly and effortlessly execute a saved test case from .android-build-mcp/testcases/. Automatically executes each step, continuously audits UI responsiveness, design/layout issues, data anomalies (null/NaN/undefined), and logcat exceptions along the way, and generates a timestamped report.',
      inputSchema: {
        id: z.string().describe('Test case ID, e.g. "TC-FURNITURE-001".'),
        targetId: z.string().optional().describe('Target Android device ID; defaults to session default.'),
        projectPath: z.string().optional().describe('Project root directory; defaults to cwd.'),
        auditEachStep: z.boolean().optional().describe('Continuously monitor screen for design/data/crash issues during execution (default true).'),
        stopOnFailure: z.boolean().optional().describe('Stop immediately if a step fails (default false).'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(async (args) => {
      const root = path.resolve(args.projectPath ?? process.cwd());
      const testCasesDir = path.join(getConfigDir(root), 'testcases');
      const slug = args.id
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);

      const filePath = path.join(testCasesDir, `${slug}.json`);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Test case [${args.id}] not found in ${filePath}. Use list_test_cases to inspect available tests.`);
      }

      const testCase = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const { target, backend } = await resolveTargetAndBackend(args.targetId);

      const steps: Array<any> = Array.isArray(testCase.steps) ? testCase.steps : [];
      const stepResults: Array<{
        stepNumber: number;
        description: string;
        action: string;
        target?: string;
        status: 'PASSED' | 'FAILED' | 'SKIPPED';
        durationMs: number;
        error?: string;
      }> = [];

      const discoveredIssues: Array<QaIssue & { stepNumber: number }> = [];
      const startTime = Date.now();

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepStart = Date.now();
        const action = (step.action || 'tap').toLowerCase();
        const targetDesc = step.target || step.description || '';

        try {
          // 1. Snapshot UI for this step
          const xml = await backend.dumpHierarchy(target.id);
          const nodes = parseUiHierarchy(xml);
          cacheSnapshot({ targetId: target.id, capturedAt: new Date().toISOString(), backend: backend.name, nodes });

          // 2. Audit screen if enabled
          if (args.auditEachStep !== false) {
            const auditRes = await auditScreen({
              targetId: target.id,
              nodes,
              checkLogs: true,
            });
            for (const iss of auditRes.issues) {
              if (!discoveredIssues.some((d) => d.title === iss.title && d.detail === iss.detail)) {
                discoveredIssues.push({ ...iss, stepNumber: step.stepNumber ?? i + 1 });
              }
            }
          }

          // 3. Execute step action
          if (action === 'tap') {
            const coords = extractCoordinates(targetDesc);
            if (coords) {
              await backend.tap(target.id, coords.x, coords.y);
            } else {
              const matchedNode = findNodeByTarget(nodes, targetDesc);
              if (matchedNode) {
                await backend.tap(target.id, matchedNode.centerX, matchedNode.centerY);
              } else {
                throw new Error(`Could not locate target on screen: "${targetDesc}"`);
              }
            }
          } else if (action === 'type_text') {
            const coords = extractCoordinates(targetDesc);
            if (coords) {
              await backend.tap(target.id, coords.x, coords.y);
            }
            const textToType = step.text || (targetDesc.includes("'") ? targetDesc.split("'")[1] : '') || '';
            if (textToType) {
              await backend.typeText(target.id, textToType);
            }
          } else if (action === 'key_press' || action === 'button') {
            await backend.keyEvent(target.id, step.key || '4'); // default 4 = KEYCODE_BACK
          } else if (action === 'wait_for_ui') {
            await new Promise((r) => setTimeout(r, 1000));
          }

          // Small delay for animation
          await new Promise((r) => setTimeout(r, 400));

          stepResults.push({
            stepNumber: step.stepNumber ?? i + 1,
            description: step.description,
            action,
            target: targetDesc,
            status: 'PASSED',
            durationMs: Date.now() - stepStart,
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          stepResults.push({
            stepNumber: step.stepNumber ?? i + 1,
            description: step.description,
            action,
            target: targetDesc,
            status: 'FAILED',
            durationMs: Date.now() - stepStart,
            error: errMsg,
          });

          if (args.stopOnFailure) {
            break;
          }
        }
      }

      const totalDuration = Date.now() - startTime;
      const passedSteps = stepResults.filter((s) => s.status === 'PASSED').length;
      const failedSteps = stepResults.filter((s) => s.status === 'FAILED').length;
      const overallStatus = failedSteps === 0 ? 'PASSED' : 'FAILED';

      // Timestamped Report Directory
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
      const reportDir = path.join(getConfigDir(root), 'test-reports', dateStr, timeStr);
      fs.mkdirSync(reportDir, { recursive: true });

      const reportMd = [
        `# Test Execution Report: ${testCase.title} (${testCase.id})`,
        '',
        `- **Status**: ${overallStatus}`,
        `- **Execution Time**: ${(totalDuration / 1000).toFixed(2)}s`,
        `- **Device**: ${target.id} (${target.model ?? target.type})`,
        `- **Steps Executed**: ${stepResults.length} (${passedSteps} passed, ${failedSteps} failed)`,
        `- **Discovered Side Findings**: ${discoveredIssues.length}`,
        '',
        '## Step Results',
        '| Step | Action | Target / Description | Status | Duration |',
        '| :--- | :--- | :--- | :--- | :--- |',
        ...stepResults.map(
          (s) =>
            `| ${s.stepNumber} | ${s.action} | ${s.description} | ${s.status === 'PASSED' ? '✅ PASSED' : '❌ FAILED'} | ${s.durationMs}ms |`
        ),
        '',
        '## Discovered Side Issues & QA Audits',
        discoveredIssues.length === 0
          ? '*(No side issues detected during execution)*'
          : discoveredIssues
              .map(
                (iss) =>
                  `- **[${iss.severity}] [${iss.category.toUpperCase()}]** (Step ${iss.stepNumber}) ${iss.title}: ${iss.detail}\n  *Recommendation*: ${iss.recommendation ?? 'N/A'}`
              )
              .join('\n'),
        '',
      ].join('\n');

      const reportJson = {
        testCaseId: testCase.id,
        title: testCase.title,
        status: overallStatus,
        durationMs: totalDuration,
        target: { id: target.id, model: target.model, type: target.type },
        stepResults,
        discoveredIssues,
        executedAt: now.toISOString(),
      };

      fs.writeFileSync(path.join(reportDir, 'report.md'), reportMd, 'utf8');
      fs.writeFileSync(path.join(reportDir, 'results.json'), JSON.stringify(reportJson, null, 2), 'utf8');

      const summaryText = [
        `Test [${testCase.id}] ${overallStatus} in ${(totalDuration / 1000).toFixed(2)}s.`,
        `Steps: ${passedSteps}/${stepResults.length} passed.`,
        discoveredIssues.length > 0
          ? `Discovered ${discoveredIssues.length} side issue(s) during execution (check QA section in report).`
          : `Zero side issues or UI glitches detected along the way.`,
        `Report saved to: ${path.join(reportDir, 'report.md')}`,
      ].join('\n');

      return textResult(summaryText, {
        testCaseId: testCase.id,
        status: overallStatus,
        passedSteps,
        totalSteps: stepResults.length,
        discoveredIssuesCount: discoveredIssues.length,
        discoveredIssues,
        reportPath: path.join(reportDir, 'report.md'),
      });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
