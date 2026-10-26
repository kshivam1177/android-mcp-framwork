import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { analyzeChangedFiles, collectGitChanges, type ChangedFile } from '../../testing-intelligence/changeImpact.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import type { ToolModule } from '../types.js';
import { resolveProjectRoot } from '../../utils/paths.js';

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
    description: 'Analyze committed and working-tree changes and recommend focused test suites. Uses a broad-regression fallback when impact cannot be mapped confidently; does not execute tests.',
    inputSchema: {
      projectPath: z.string().optional().describe('Git project root; defaults to the server working directory.'),
      base: z.string().optional().describe('Git base ref; defaults to HEAD~1.'),
      changedFiles: z.array(changedFileSchema).optional().describe('Optional explicit change list; when supplied, Git is not invoked.'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, withErrorHandling(async (args: { projectPath?: string; base?: string; changedFiles?: ChangedFile[] }) => {
    const result = args.changedFiles
      ? analyzeChangedFiles(args.changedFiles, args.base ?? 'HEAD~1')
      : await collectGitChanges(resolveProjectRoot(args.projectPath ?? process.cwd()), args.base ?? 'HEAD~1');
    return textResult(JSON.stringify(result, null, 2), result as unknown as Record<string, unknown>);
  }));
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
