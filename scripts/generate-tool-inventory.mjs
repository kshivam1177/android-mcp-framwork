#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'docs', 'generated-tool-inventory.md');
const mode = process.argv[2] ?? '--check';
if (!['--check', '--write'].includes(mode)) {
  process.stderr.write('Usage: node scripts/generate-tool-inventory.mjs [--check|--write]\n');
  process.exit(2);
}
const cli = spawnSync(process.execPath, [path.join(root, 'build', 'cli', 'index.js'), 'tools', '--json'], { cwd: root, encoding: 'utf8', timeout: 15000 });
if (cli.error || cli.status !== 0) {
  process.stderr.write('Could not read runtime MCP tool registry. Run npm run build first.\n' + (cli.stderr ?? '') + '\n');
  process.exit(2);
}
let tools;
try { tools = JSON.parse(cli.stdout); } catch (error) { throw new Error('CLI tools --json did not return valid JSON: ' + String(error)); }
if (!Array.isArray(tools) || tools.some((item) => typeof item.tool !== 'string' || typeof item.workflow !== 'string')) throw new Error('Runtime MCP tool inventory has an unexpected shape.');
const rows = tools.slice().sort((a, b) => a.workflow.localeCompare(b.workflow) || a.tool.localeCompare(b.tool)).map((item) => '| ' + item.workflow + ' | ' + item.tool + ' |');
const expected = '# Generated MCP Tool Inventory\n\nGenerated from the registered MCP tool list. Run npm run docs:generate to refresh this file; CI checks for drift.\n\n| Workflow | Tool |\n|---|---|\n' + rows.join('\n') + '\n';
if (mode === '--write') {
  fs.writeFileSync(destination, expected, 'utf8');
  process.stdout.write('Wrote ' + path.relative(root, destination) + ' (' + tools.length + ' registered tools).\n');
} else {
  const current = fs.existsSync(destination) ? fs.readFileSync(destination, 'utf8') : '';
  if (current !== expected) {
    process.stderr.write('Generated tool inventory is stale. Run npm run docs:generate and commit docs/generated-tool-inventory.md.\n');
    process.exit(1);
  }
  process.stdout.write('Generated tool inventory is current (' + tools.length + ' registered tools).\n');
}
