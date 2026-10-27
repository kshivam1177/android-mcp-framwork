import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfigDir } from '../../config/loader.js';
import { collectGitChanges, type StoredTestCase } from '../../testing-intelligence/changeImpact.js';
import { planFromRequest } from '../../testing-intelligence/planner.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { resolveProjectRoot } from '../../utils/paths.js';
import type { ToolModule } from '../types.js';

export const toolName = 'plan_test_run';
export const workflow = 'testing-intelligence';

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Plan Tests from a Natural-Language Request',
    description: 'Turn a request into a reviewable test plan using saved test cases, explicit changed-file mappings, and project test knowledge. It reuses stored steps/assertions only, lists coverage gaps, and never executes tests.',
    inputSchema: {
      request: z.string().min(3).max(4000),
      projectPath: z.string().optional(),
      base: z.string().optional().describe('Git base ref for changed-file context; defaults to HEAD~1.'),
      maxTestCases: z.number().int().min(1).max(30).optional().default(10),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, withErrorHandling(async (args: { request: string; projectPath?: string; base?: string; maxTestCases?: number }) => {
    const projectRoot = resolveProjectRoot(path.resolve(args.projectPath ?? process.cwd()));
    const configDir = getConfigDir(projectRoot);
    const testCaseDir = path.join(configDir, 'testcases');
    const testCases: StoredTestCase[] = [];
    const warnings: string[] = [];
    try {
      for (const file of (await fs.readdir(testCaseDir)).filter(name => name.endsWith('.json')).sort()) {
        try {
          const parsed: unknown = JSON.parse(await fs.readFile(path.join(testCaseDir, file), 'utf8'));
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) testCases.push({ ...(parsed as StoredTestCase), file: path.join(testCaseDir, file) });
          else warnings.push(`Ignored malformed test case: ${file}`);
        } catch { warnings.push(`Ignored malformed test case: ${file}`); }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    let changedFiles: Array<{ status: 'added'|'modified'|'deleted'|'renamed'|'copied'|'unknown'; path: string; previousPath?: string }> = [];
    try {
      changedFiles = (await collectGitChanges(projectRoot, args.base ?? 'HEAD~1')).changedFiles;
    } catch (error) {
      warnings.push(`Git change context unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
    const plan = planFromRequest({ request: args.request, changedFiles, testCases, maxTestCases: args.maxTestCases });
    const instructions: Array<{ name: string; path: string; content: string }> = [];
    const instructionDir = path.join(configDir, 'instructions');
    try {
      const files = (await fs.readdir(instructionDir)).filter(file => file.endsWith('.md')).sort();
      const requestTerms = new Set(args.request.toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 2));
      for (const file of files) {
        const content = (await fs.readFile(path.join(instructionDir, file), 'utf8')).slice(0, 12000);
        const nameTerms = file.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
        const contentTerms = new Set(content.toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 2));
        if (nameTerms.some(term => requestTerms.has(term)) || [...requestTerms].some(term => contentTerms.has(term))) {
          instructions.push({ name: file.replace(/\.md$/i, ''), path: path.relative(projectRoot, path.join(instructionDir, file)).split(path.sep).join('/'), content });
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const result = { ...plan, relevantInstructions: instructions, warnings };
    return textResult(JSON.stringify(result, null, 2), result);
  }));
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
