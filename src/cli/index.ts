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
import { PROJECT_CONFIG_DIR, findProjectConfigPath, resolveProjectRoot } from '../utils/paths.js';
import { runSelfUpdate } from './update.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

async function runMcp(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
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

function runUpdate(): void {
  const packageRoot = path.resolve(moduleDir, '..', '..');
  const result = runSelfUpdate(packageRoot);
  if (!result.success) process.exitCode = 1;
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
    for (const t of w.tools) console.log(`  ${t.toolName}`);
  }
}

function setupConfig(cwd: string, migrate: boolean): void {
  const projectRoot = resolveProjectRoot(cwd);
  const canonicalDir = path.join(projectRoot, PROJECT_CONFIG_DIR);
  const canonicalPath = path.join(canonicalDir, 'config.yaml');
  const existingCanonical = fs.existsSync(canonicalPath);
  const legacyPath = findProjectConfigPath(projectRoot);

  if (existingCanonical) {
    console.log(`${canonicalPath} already exists - leaving it as-is.`);
    return;
  }

  if (legacyPath && legacyPath !== canonicalPath) {
    if (!migrate) {
      console.log(`Found existing config at ${legacyPath}.`);
      console.log(`Run "androidmcp-framework setup --migrate" to copy legacy project data into ${canonicalDir}; existing files will never be overwritten.`);
      return;
    }
    fs.mkdirSync(canonicalDir, { recursive: true });
    fs.cpSync(path.dirname(legacyPath), canonicalDir, { recursive: true, errorOnExist: true, force: false });
    console.log(`Migrated project configuration from ${path.dirname(legacyPath)} to ${canonicalDir} without overwriting files.`);
    return;
  }

  fs.mkdirSync(canonicalDir, { recursive: true });
  const examplePath = path.resolve(moduleDir, '..', '..', 'config.example.yaml');
  const contents = fs.existsSync(examplePath)
    ? fs.readFileSync(examplePath, 'utf8')
    : 'schemaVersion: 1\nenabledWorkflows: [device, ui-automation, session-management, doctor, workflow-discovery, testing-intelligence]\n';
  fs.writeFileSync(canonicalPath, contents, { encoding: 'utf8', flag: 'wx' });
  console.log(`Wrote ${canonicalPath}.`);
  console.log('Edit enabledWorkflows and sessionDefaults for your project, then restart your MCP client.');
}

await yargs(hideBin(process.argv))
  .scriptName('androidmcp-framework')
  .command('mcp', 'Start the MCP server over stdio (for MCP clients)', () => {}, runMcp)
  .command('doctor', 'Check the local Android toolchain (adb, java, gradle, SDK, emulator)', () => {}, runDoctor)
  .command('update', 'Update the global androidmcp-framework installation to the latest npm version and clear npm cache', () => {}, runUpdate)
  .command('workflows', 'List every workflow, its tool count, and whether it is on by default', () => {}, listWorkflows)
  .command(
    'tools',
    'List every tool, grouped by workflow',
    (y) => y.option('json', { type: 'boolean', default: false, describe: 'Emit machine-readable JSON instead' }),
    (argv) => listTools(Boolean(argv.json))
  )
  .command(
    'setup',
    'Initialize .androidmcp-framework/ in the current project; use --migrate to copy legacy files safely',
    (y) => y.option('migrate', { type: 'boolean', default: false, describe: 'Copy files from a legacy project directory without overwriting existing files' }),
    (argv) => setupConfig(process.cwd(), Boolean(argv.migrate))
  )
  .demandCommand(1, 'Pass a command - try "androidmcp-framework --help".')
  .strict()
  .help()
  .parseAsync();
