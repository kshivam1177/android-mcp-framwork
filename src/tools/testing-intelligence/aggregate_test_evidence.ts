import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfigDir } from '../../config/loader.js';
import { aggregateEvidence } from '../../testing-intelligence/evidenceAggregation.js';
import { resolveProjectRoot } from '../../utils/paths.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import type { ToolModule } from '../types.js';

export const toolName = 'aggregate_test_evidence';
export const workflow = 'testing-intelligence';
const REPORT_NAMES = new Set(['report.json', 'results.json', 'workflow-report.json', 'replay-report.json', 'summary.json']);
async function findReports(current: string, results: string[] = []): Promise<string[]> {
  let entries;
  try { entries = await fs.readdir(current, { withFileTypes: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return results; throw error; }
  for (const entry of entries) {
    if (entry.name === 'evidence-index.json' || entry.name === 'evidence-index.md') continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) await findReports(absolute, results);
    else if (entry.isFile() && REPORT_NAMES.has(entry.name)) results.push(absolute);
  }
  return results;
}
export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Aggregate Test Evidence Across Retries',
    description: 'Build an index of screenshot, log, snapshot, recording, and other evidence references from prior reports. It never changes or deletes source evidence; missing references remain visible in the manifest.',
    inputSchema: { projectPath: z.string().optional(), reportPaths: z.array(z.string()).max(200).optional() },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, withErrorHandling(async (args: { projectPath?: string; reportPaths?: string[] }) => {
    const root = resolveProjectRoot(path.resolve(args.projectPath ?? process.cwd()));
    const reportsRoot = path.join(getConfigDir(root), 'test-reports');
    const reports = args.reportPaths?.length
      ? args.reportPaths.map(item => path.resolve(root, item)).filter(item => {
          const relative = path.relative(root, item);
          return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
        })
      : await findReports(reportsRoot);
    const evidence = await aggregateEvidence(root, reports);
    const now = new Date();
    const outDir = path.join(reportsRoot, now.toISOString().slice(0, 10), now.toISOString().slice(11, 19).replace(/:/g, '') + '-evidence-' + randomUUID().slice(0, 8));
    await fs.mkdir(outDir, { recursive: true });
    const jsonPath = path.join(outDir, 'evidence-index.json');
    const mdPath = path.join(outDir, 'evidence-index.md');
    const manifest = { schemaVersion: 1, generatedAt: now.toISOString(), sourceReportCount: reports.length, evidenceCount: evidence.length, existingCount: evidence.filter(item => item.exists).length, missingCount: evidence.filter(item => !item.exists).length, evidence };
    const lines = ['# Test Evidence Index', '', '- Source reports: ' + reports.length, '- Evidence references: ' + evidence.length, '- Existing: ' + manifest.existingCount, '- Missing: ' + manifest.missingCount, '', '## Evidence', ...evidence.map(item => '- [' + (item.exists ? 'available' : 'missing') + '] **' + item.kind + '** `' + item.path + '` (from `' + item.sourceReport + '`)'), '', 'Missing files are retained as references and do not imply a passing or failing test outcome.', ''];
    await Promise.all([
      fs.writeFile(jsonPath, JSON.stringify(manifest, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' }),
      fs.writeFile(mdPath, lines.join('\n'), { encoding: 'utf8', flag: 'wx' }),
    ]);
    const result = { ...manifest, jsonPath: path.relative(root, jsonPath).split(path.sep).join('/'), markdownPath: path.relative(root, mdPath).split(path.sep).join('/') };
    return textResult(JSON.stringify(result, null, 2), result);
  }));
}
const mod: ToolModule = { toolName, workflow, register };
export default mod;
