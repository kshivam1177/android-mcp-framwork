#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from '../mcp/server.js';
import { WORKFLOWS } from '../workflows.js';
import { runDoctorChecks } from '../tools/doctor/doctor.js';
import { getConfigDir } from '../config/loader.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

async function runMcp(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Intentionally never resolves on its own - the stdio transport keeps the
  // process alive until the MCP client disconnects.
}

async function runDoctor(): Promise<void> {
  const { summary, checks } = await runDoctorChecks();
  console.log(summary);
  for (const check of checks) {
    const status = check.ok ? 'OK  ' : check.required ? 'FAIL' : 'skip';
    console.log(`  [${status}] ${check.name}: ${check.detail}`);
  }
  process.exitCode = checks.some((c) => c.required && !c.ok) ? 1 : 0;
}

function listWorkflows(): void {
  for (const w of WORKFLOWS) {
    console.log(`${w.name} (${w.tools.length} tools)${w.defaultEnabled ? ' [enabled by default]' : ''}`);
    console.log(`  ${w.description}`);
  }
}

function listTools(json: boolean): void {
  if (json) {
    const all = WORKFLOWS.flatMap((w) => w.tools.map((t) => ({ tool: t.toolName, workflow: w.name })));
    console.log(JSON.stringify(all, null, 2));
    return;
  }
  for (const w of WORKFLOWS) {
    console.log(`\n${w.name}:`);
    for (const t of w.tools) {
      console.log(`  ${t.toolName}`);
    }
  }
}

function setupConfig(cwd: string): void {
  const dir = getConfigDir(cwd);
  const configPath = path.join(dir, 'config.yaml');
  if (fs.existsSync(configPath)) {
    console.log(`${configPath} already exists - leaving it as-is.`);
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  const examplePath = path.resolve(moduleDir, '..', '..', 'config.example.yaml');
  const contents = fs.existsSync(examplePath)
    ? fs.readFileSync(examplePath, 'utf8')
    : 'schemaVersion: 1\nenabledWorkflows: [device, ui-automation, session-management, doctor]\n';
  fs.writeFileSync(configPath, contents, 'utf8');
  console.log(`Wrote ${configPath}.`);
  console.log('Edit enabledWorkflows and sessionDefaults for your project, then restart your MCP client.');
}

await yargs(hideBin(process.argv))
  .scriptName('androidmcp-framework')
  .command('mcp', 'Start the MCP server over stdio (for MCP clients)', () => {}, runMcp)
  .command('doctor', 'Check the local Android toolchain (adb, java, gradle, SDK, emulator)', () => {}, runDoctor)
  .command('workflows', 'List every workflow, its tool count, and whether it is on by default', () => {}, listWorkflows)
  .command(
    'tools',
    'List every tool, grouped by workflow',
    (y) => y.option('json', { type: 'boolean', default: false, describe: 'Emit machine-readable JSON instead' }),
    (argv) => listTools(Boolean(argv.json))
  )
  .command(
    'setup',
    'Write a starter .android-build-mcp/config.yaml in the current directory',
    () => {},
    () => setupConfig(process.cwd())
  )
  .demandCommand(1, 'Pass a command - try "androidmcp-framework --help".')
  .strict()
  .help()
  .parseAsync();
