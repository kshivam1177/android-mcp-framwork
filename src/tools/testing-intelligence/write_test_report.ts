import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { getConfigDir } from '../../config/loader.js';
import type { ToolModule } from '../types.js';
export const toolName = 'write_test_report';
export const workflow = 'testing-intelligence';
export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Write Test Report',
    description: 'Write a Markdown report and machine-readable JSON results into .android-build-mcp/test-reports/YYYY-MM-DD/HHmmss. Does not claim tests passed unless the supplied results say so.',
    inputSchema: { projectPath: z.string().optional(), title: z.string().min(1).max(200), summary: z.string().min(1).max(20000), resultsJson: z.string().optional().describe('Optional JSON string with test cases, statuses, evidence, and environment details.') },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, withErrorHandling(async (args: { projectPath?: string; title: string; summary: string; resultsJson?: string }) => {
    const root = path.resolve(args.projectPath ?? process.cwd());
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`Project directory does not exist: ${root}`);
    let parsed: unknown = { status: 'not-provided', note: 'No structured results were supplied; this report does not assert test execution or success.' };
    if (args.resultsJson?.trim()) parsed = JSON.parse(args.resultsJson);
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toISOString().slice(11, 19).replace(/:/g, '');
    const base = path.join(getConfigDir(root), 'test-reports', date);
    fs.mkdirSync(base, { recursive: true });
    let runDir = path.join(base, time); let suffix = 1;
    while (fs.existsSync(runDir)) runDir = path.join(base, `${time}-${suffix++}`);
    fs.mkdirSync(runDir, { recursive: true });
    const md = `# ${args.title}\n\n- **Generated:** ${now.toISOString()}\n- **Project:** ${root}\n- **Result status:** See structured results; not inferred by the report writer.\n\n## Summary\n\n${args.summary.trim()}\n\n## Structured results\n\nSee \`results.json\`.\n`;
    fs.writeFileSync(path.join(runDir, 'report.md'), md, 'utf8');
    fs.writeFileSync(path.join(runDir, 'results.json'), `${JSON.stringify({ generatedAt: now.toISOString(), projectRoot: root, title: args.title, results: parsed }, null, 2)}\n`, 'utf8');
    return textResult(`Test report saved to ${runDir}`, { directory: runDir, report: path.join(runDir, 'report.md'), results: path.join(runDir, 'results.json') });
  }));
}
const mod: ToolModule = { toolName, workflow, register };
export default mod;
