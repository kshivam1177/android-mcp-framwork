#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { loadConfig } from '../config/loader.js';

const cli = yargs(hideBin(process.argv)).scriptName('androidbuildmcp').command('doctor', 'Check local Android development requirements', {}, async () => {
  const config = await loadConfig();
  console.log(JSON.stringify({ node: process.version, platform: process.platform, config }, null, 2));
}).command('tools', 'List available AndroidBuildMCP tools', {}, () => {
  console.log(JSON.stringify({ message: 'Build the project and connect over MCP to inspect registered tool definitions.' }, null, 2));
}).command('mcp', 'Start the MCP server', {}, async () => {
  const { startMcpServer } = await import('../mcp/server.js');
  await startMcpServer();
}).demandCommand().strict().help();

await cli.parseAsync();
