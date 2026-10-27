#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { evaluateTestGate } from '../build/testing-intelligence/testGate.js';

const args = process.argv.slice(2);
let reportPath;
let allowSkipped = false;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--report') {
    reportPath = args[++i];
    if (!reportPath) {
      process.stderr.write('Missing value for --report.\n');
      process.exit(2);
    }
  } else if (arg === '--allow-skipped') {
    allowSkipped = true;
  } else if (arg === '--help' || arg === '-h') {
    process.stdout.write('Usage: npm run test:gate -- --report <summary.json> [--allow-skipped]\n');
    process.exit(0);
  } else {
    process.stderr.write('Unknown argument: ' + arg + '\n');
    process.exit(2);
  }
}
if (!reportPath) {
  process.stderr.write('A consolidated summary path is required. Run consolidate_test_reports first.\n');
  process.exit(2);
}
try {
  const absolute = path.resolve(reportPath);
  const report = JSON.parse(await fs.readFile(absolute, 'utf8'));
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error('Report JSON must contain an object.');
  const gate = evaluateTestGate({
    status: report.status,
    passed: report.passed,
    failed: report.failed,
    skipped: report.skipped,
    testCount: report.testCount,
    allowSkipped,
  });
  process.stdout.write(JSON.stringify({ ...gate, reportPath: absolute, allowSkipped }, null, 2) + '\n');
  process.exitCode = gate.decision === 'pass' ? 0 : 1;
} catch (error) {
  process.stderr.write('Could not evaluate test report: ' + (error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 2;
}
