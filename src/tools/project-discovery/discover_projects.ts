import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { displayPath } from '../../utils/paths.js';
import type { ToolModule } from '../types.js';

export const toolName = 'discover_projects';
export const workflow = 'project-discovery';

const SKIP_DIRS = new Set(['node_modules', '.git', 'build', '.gradle', '.idea']);

function scan(dir: string, depthLeft: number, found: string[]): void {
  if (depthLeft < 0) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  const hasSettings = entries.some((e) => e.isFile() && (e.name === 'settings.gradle' || e.name === 'settings.gradle.kts'));
  if (hasSettings) {
    found.push(dir);
    return; // don't recurse into a discovered project's own build/module subtrees
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
      scan(path.join(dir, entry.name), depthLeft - 1, found);
    }
  }
}

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Discover Projects',
      description: 'Scan a directory (default: cwd) for Gradle project roots (folders containing settings.gradle or settings.gradle.kts). Use when the project path is unknown.',
      inputSchema: {
        searchPath: z.string().optional().describe('Defaults to the current working directory.'),
        maxDepth: z.number().optional().describe('Default 4.'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    withErrorHandling(async (args: { searchPath?: string; maxDepth?: number }) => {
      const root = path.resolve(args.searchPath ?? process.cwd());
      const found: string[] = [];
      scan(root, args.maxDepth ?? 4, found);
      const relative = found.map((f) => displayPath(f, root));
      return textResult(found.length > 0 ? relative.join('\n') : `No Gradle projects found under ${root}.`, { projects: found });
    })
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
