import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { analyzeChangedFiles, analyzeTestCaseImpact, collectGitChanges, type ChangedFile, type StoredTestCase } from '../../testing-intelligence/changeImpact.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import type { ToolModule } from '../types.js';
import { resolveProjectRoot } from '../../utils/paths.js';
import fs from 'node:fs';
import path from 'node:path';
import { getConfigDir } from '../../config/loader.js';

export const toolName = 'analyze_changes';
export const workflow = 'testing-intelligence';
const changedFileSchema = z.object({
  status: z.enum(['added', 'modified', 'deleted', 'renamed', 'copied', 'unknown']),
  path: z.string().min(1),
  previousPath: z.string().optional(),
});

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Analyze Changes for Testing',
    description: 'Analyze Git changes, recommend focused suites, and match changed paths to saved test cases with explicit file/module mappings. Uses a broad-regression fallback when coverage is uncertain; does not execute tests.',
    inputSchema: {
      projectPath: z.string().optional().describe('Git project root; defaults to the server working directory.'),
      base: z.string().optional().describe('Git base ref; defaults to HEAD~1.'),
      changedFiles: z.array(changedFileSchema).optional().describe('Optional explicit change list; when supplied, Git is not invoked.'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, withErrorHandling(async (args: { projectPath?: string; base?: string; changedFiles?: ChangedFile[] }) => {
    const projectRoot = resolveProjectRoot(args.projectPath ?? process.cwd());
    const analysis = args.changedFiles
      ? analyzeChangedFiles(args.changedFiles, args.base ?? 'HEAD~1')
      : await collectGitChanges(projectRoot, args.base ?? 'HEAD~1');
    const testCaseDir = path.join(getConfigDir(projectRoot), 'testcases');
    const testCases: StoredTestCase[] = [];
    const invalidTestCaseFiles: string[] = [];
    if (fs.existsSync(testCaseDir) && fs.statSync(testCaseDir).isDirectory()) {
      for (const file of fs.readdirSync(testCaseDir).filter(name => name.endsWith('.json')).sort()) {
        try {
          const parsed: unknown = JSON.parse(fs.readFileSync(path.join(testCaseDir, file), 'utf8'));
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            testCases.push({ ...(parsed as StoredTestCase), file: path.join(testCaseDir, file) });
          } else invalidTestCaseFiles.push(file);
        } catch {
          invalidTestCaseFiles.push(file);
        }
      }
    }
    const testCaseImpact = analyzeTestCaseImpact(analysis.changedFiles, testCases);
    const result = {
      ...analysis,
      selectedSuites: testCaseImpact.requiresBroadRegression
        ? [...new Set([...analysis.selectedSuites, 'broad-regression'])].sort()
        : analysis.selectedSuites,
      fallbackToBroadRun: analysis.fallbackToBroadRun || testCaseImpact.requiresBroadRegression,
      ...testCaseImpact,
      testCaseCount: testCases.length,
      invalidTestCaseFiles,
      nextAction: testCaseImpact.requiresBroadRegression
        ? 'Run mapped test cases and broad regression; inspect unmapped files before narrowing coverage.'
        : 'Run the selected mapped test cases, then review the report for gaps.',
    };
    return textResult(JSON.stringify(result, null, 2), result as unknown as Record<string, unknown>);
  }));
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
