import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfigDir } from '../../config/loader.js';
import { resolveProjectRoot } from '../../utils/paths.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import type { ToolModule } from '../types.js';

export const toolName = 'approve_selector_repair';
export const workflow = 'testing-intelligence';

type NodeEvidence = { text?: string; contentDesc?: string; resourceId?: string; clickable?: boolean; enabled?: boolean };
type RepairInput = {
  testCaseId: string;
  stepNumber: number;
  originalTarget: string;
  proposedTarget: string;
  hierarchy: NodeEvidence[];
  evidenceCapturedAt: string;
  approve?: boolean;
  projectPath?: string;
};

function normalize(value: string): string { return value.trim().toLocaleLowerCase(); }
export function resolveUniqueTarget(target: string, nodes: NodeEvidence[]): { matches: number; clickable: boolean; enabled: boolean } {
  const needle = normalize(target);
  if (!needle) return { matches: 0, clickable: false, enabled: false };
  const exact = nodes.filter(n => [n.text, n.contentDesc, n.resourceId].some(v => v !== undefined && normalize(v) === needle));
  const matches = exact.length ? exact : nodes.filter(n => [n.text, n.contentDesc, n.resourceId].some(v => {
    const candidate = v ? normalize(v) : '';
    return candidate.length > 0 && (needle.includes(candidate) || candidate.includes(needle));
  }));
  return { matches: matches.length, clickable: matches.length === 1 && matches[0]?.clickable === true, enabled: matches.length === 1 && matches[0]?.enabled === true };
}
export function evaluateRepair(input: Omit<RepairInput, 'projectPath' | 'approve' | 'testCaseId' | 'stepNumber'> & { action?: string; now?: number }) {
  const captured = Date.parse(input.evidenceCapturedAt);
  const ageMs = (input.now ?? Date.now()) - captured;
  const target = resolveUniqueTarget(input.proposedTarget, input.hierarchy);
  const issues: string[] = [];
  if (!input.originalTarget.trim()) issues.push('Original target is required.');
  if (!input.proposedTarget.trim()) issues.push('Proposed target is required.');
  if (!Number.isFinite(captured) || ageMs < 0 || ageMs > 5 * 60_000) issues.push('Hierarchy evidence must have a valid timestamp no more than five minutes old.');
  if (target.matches !== 1) issues.push('Proposed target must resolve to exactly one node in the supplied hierarchy.');
  if (input.action?.toLowerCase() === 'tap' && !target.clickable) issues.push('A tap repair must resolve to a clickable node.');
  if (!target.enabled) issues.push('Proposed target is not enabled or its enabled state is unknown.');
  return { valid: issues.length === 0, issues, targetResolution: target, evidenceAgeMs: Number.isFinite(ageMs) ? ageMs : null };
}

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Review and Approve a Runtime-Verified Selector Repair',
    description: 'Validates a proposed saved-test selector against a fresh caller-supplied accessibility hierarchy. Without approve=true it is read-only. Explicit approval rechecks the current saved step, creates a backup and audit record, and updates only that step. This is not a substitute for rerunning the test.',
    inputSchema: {
      projectPath: z.string().optional(),
      testCaseId: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
      stepNumber: z.number().int().min(1).max(1000),
      originalTarget: z.string().min(1).max(500),
      proposedTarget: z.string().min(1).max(500),
      evidenceCapturedAt: z.string().datetime(),
      hierarchy: z.array(z.object({
        text: z.string().optional(), contentDesc: z.string().optional(), resourceId: z.string().optional(),
        clickable: z.boolean().optional(), enabled: z.boolean().optional(),
      })).min(1).max(5000),
      approve: z.boolean().optional().default(false),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, withErrorHandling(async (args: RepairInput) => {
    const root = resolveProjectRoot(path.resolve(args.projectPath ?? process.cwd()));
    const config = getConfigDir(root);
    const casePath = path.join(config, 'testcases', args.testCaseId + '.json');
    const parsed = JSON.parse(await fs.readFile(casePath, 'utf8')) as { id?: string; steps?: Array<Record<string, unknown>>; [key: string]: unknown };
    if (!Array.isArray(parsed.steps) || !parsed.steps[args.stepNumber - 1]) throw new Error('Saved test case does not contain step ' + args.stepNumber + '.');
    const step = parsed.steps[args.stepNumber - 1]!;
    const currentTarget = typeof step.target === 'string' ? step.target : '';
    if (currentTarget !== args.originalTarget) {
      throw new Error('Stale repair proposal: current saved target differs from originalTarget. Reload the test case and prepare a new repair.');
    }
    const validation = evaluateRepair({
      originalTarget: args.originalTarget, proposedTarget: args.proposedTarget, hierarchy: args.hierarchy,
      evidenceCapturedAt: args.evidenceCapturedAt, action: typeof step.action === 'string' ? step.action : 'tap',
    });
    const evidenceDigest = createHash('sha256').update(JSON.stringify(args.hierarchy)).digest('hex');
    if (!validation.valid) {
      const result = { status: 'needs-review', approved: false, testCaseId: args.testCaseId, stepNumber: args.stepNumber, ...validation, evidenceDigest, execution: 'not-run' };
      return textResult(JSON.stringify(result, null, 2), result as unknown as Record<string, unknown>);
    }
    if (!args.approve) {
      const result = { status: 'valid-awaiting-explicit-approval', approved: false, testCaseId: args.testCaseId, stepNumber: args.stepNumber, originalTarget: args.originalTarget, proposedTarget: args.proposedTarget, ...validation, evidenceDigest, execution: 'not-run', note: 'No files were changed. Re-run with approve=true only after reviewing the proposed selector and hierarchy.' };
      return textResult(JSON.stringify(result, null, 2), result as unknown as Record<string, unknown>);
    }
    const repairDir = path.join(config, 'selector-repairs');
    const backupDir = path.join(repairDir, 'backups');
    await fs.mkdir(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, args.testCaseId + '-' + stamp + '.json');
    await fs.writeFile(backupPath, JSON.stringify(parsed, null, 2) + '\n', { flag: 'wx' });
    step.target = args.proposedTarget;
    await fs.writeFile(casePath, JSON.stringify(parsed, null, 2) + '\n', { flag: 'w' });
    const audit = {
      schemaVersion: 1, testCaseId: args.testCaseId, stepNumber: args.stepNumber,
      originalTarget: args.originalTarget, proposedTarget: args.proposedTarget,
      evidenceCapturedAt: args.evidenceCapturedAt, evidenceDigest, approvedAt: new Date().toISOString(),
      backupPath: path.relative(root, backupPath).split(path.sep).join('/'),
      testCasePath: path.relative(root, casePath).split(path.sep).join('/'),
      execution: 'not-run', requiresRerun: true,
    };
    await fs.appendFile(path.join(repairDir, 'audit.jsonl'), JSON.stringify(audit) + '\n', 'utf8');
    const result = { status: 'approved-and-updated', approved: true, ...audit, note: 'Only the selected step target was changed. Rerun the test; this repair is not evidence of a passing test.' };
    return textResult(JSON.stringify(result, null, 2), result as unknown as Record<string, unknown>);
  }));
}
const mod: ToolModule = { toolName, workflow, register };
export default mod;
