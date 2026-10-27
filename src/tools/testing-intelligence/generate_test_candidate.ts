import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfigDir } from '../../config/loader.js';
import { resolveProjectRoot } from '../../utils/paths.js';
import { createTestCandidate } from '../../testing-intelligence/testCandidate.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import type { ToolModule } from '../types.js';

export const toolName = 'generate_test_candidate';
export const workflow = 'testing-intelligence';
export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Generate a Reviewable Test Candidate',
    description: 'Create a non-executable, review-required AndroidMCP test candidate from a natural-language request and explicit acceptance criteria. It does not invent criteria, modify source code, or claim to generate Google Android CLI Journey syntax.',
    inputSchema: {
      request: z.string().min(3).max(4000),
      acceptanceCriteria: z.array(z.string().min(1).max(500)).min(1).max(30),
      platform: z.enum(['android', 'flutter', 'cross-platform']).optional().default('android'),
      projectPath: z.string().optional(),
      save: z.boolean().optional().default(true),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, withErrorHandling(async (args: { request: string; acceptanceCriteria: string[]; platform?: 'android' | 'flutter' | 'cross-platform'; projectPath?: string; save?: boolean }) => {
    const root = resolveProjectRoot(path.resolve(args.projectPath ?? process.cwd()));
    const candidate = createTestCandidate({ request: args.request, acceptanceCriteria: args.acceptanceCriteria, platform: args.platform ?? 'android' });
    if (args.save === false) return textResult(JSON.stringify(candidate, null, 2), candidate);
    const dir = path.join(getConfigDir(root), 'generated-tests');
    await fs.mkdir(dir, { recursive: true });
    const base = candidate.id + '.json';
    let file = path.join(dir, base);
    let index = 1;
    while (true) {
      try { await fs.access(file); file = path.join(dir, candidate.id + '-' + index++ + '.json'); }
      catch { break; }
    }
    await fs.writeFile(file, JSON.stringify(candidate, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    const result = { ...candidate, savedTo: path.relative(root, file).split(path.sep).join('/') };
    return textResult(JSON.stringify(result, null, 2), result);
  }));
}
const mod: ToolModule = { toolName, workflow, register };
export default mod;
