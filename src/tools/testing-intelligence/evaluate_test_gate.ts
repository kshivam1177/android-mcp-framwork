import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfigDir } from '../../config/loader.js';
import { evaluateTestGate } from '../../testing-intelligence/testGate.js';
import { resolveProjectRoot } from '../../utils/paths.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import type { ToolModule } from '../types.js';

export const toolName = 'evaluate_test_gate';
export const workflow = 'testing-intelligence';
async function findSummaries(root: string, output: string[] = []): Promise<string[]> {
  let entries;
  try { entries = await fs.readdir(root, { withFileTypes: true }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return output; throw error; }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) await findSummaries(full, output);
    else if (entry.isFile() && entry.name === 'summary.json') output.push(full);
  }
  return output;
}
export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Evaluate a Test Report CI Gate',
    description: 'Evaluate explicit pass/fail/skipped counts from a consolidated test summary. Empty or incomplete reports do not pass by default. This returns a gate decision for CI/coding agents; it does not mutate CI settings or launch tests.',
    inputSchema: {
      projectPath: z.string().optional(),
      reportPath: z.string().optional().describe('Path to a consolidated summary.json, relative to project root or absolute inside it. Defaults to the newest summary.'),
      allowSkipped: z.boolean().optional().default(false),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, withErrorHandling(async (args: { projectPath?: string; reportPath?: string; allowSkipped?: boolean }) => {
    const root = resolveProjectRoot(path.resolve(args.projectPath ?? process.cwd()));
    let reportPath: string | undefined;
    if (args.reportPath) {
      reportPath = path.resolve(root, args.reportPath);
      const relative = path.relative(root, reportPath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('reportPath must resolve inside the project root.');
    } else {
      const files = await findSummaries(path.join(getConfigDir(root), 'test-reports'));
      const stats = await Promise.all(files.map(async file => ({ file, mtime: (await fs.stat(file)).mtimeMs })));
      reportPath = stats.sort((a, b) => b.mtime - a.mtime)[0]?.file;
    }
    if (!reportPath) {
      const gate = evaluateTestGate({ allowSkipped: args.allowSkipped });
      const result = { ...gate, reportPath: null, message: 'No consolidated summary was found; create one with consolidate_test_reports first.' };
      return textResult(JSON.stringify(result, null, 2), result);
    }
    const raw: unknown = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Report JSON must contain an object.');
    const value = raw as Record<string, unknown>;
    const gate = evaluateTestGate({ status: value.status, passed: value.passed, failed: value.failed, skipped: value.skipped, testCount: value.testCount, allowSkipped: args.allowSkipped });
    const result = { ...gate, reportPath: path.relative(root, reportPath).split(path.sep).join('/'), policy: { allowSkipped: args.allowSkipped ?? false, requiresNonEmptyResults: true, explicitPassRequired: true } };
    return textResult(JSON.stringify(result, null, 2), result);
  }));
}
const mod: ToolModule = { toolName, workflow, register };
export default mod;
