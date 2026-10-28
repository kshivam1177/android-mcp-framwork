#!/usr/bin/env node
// Make the standalone binary behave like: androidmcp-framework skill-gen.
process.argv.splice(2, 0, 'skill-gen');
await import('./index.js');
