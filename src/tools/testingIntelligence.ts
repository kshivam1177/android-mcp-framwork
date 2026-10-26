import type { ToolDefinition } from './types.js';
import { analyzeChangedFiles, collectGitChanges, type ChangedFile } from '../testing-intelligence/changeImpact.js';
import { resolveInstructions, validateTestPlan, type ScopedInstructions } from '../testing-intelligence/instructions.js';
import { writeTestRunReport, type TestRunReport } from '../testing-intelligence/report.js';

function objectInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Input must be a JSON object.');
  return input as Record<string, unknown>;
}

export const testingIntelligenceTools: ToolDefinition[] = [
  {
    name: 'android_test_analyze_changes',
    description: 'Analyze Git changes and recommend focused test suites. Uses a broad-regression fallback whenever impact is uncertain; does not execute tests.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string', description: 'Git project root; defaults to the current working directory.' },
        base: { type: 'string', description: 'Base ref for committed changes; defaults to HEAD~1.' },
        changedFiles: { type: 'array', description: 'Optional explicit changed-file list to analyze without invoking Git.', items: { type: 'object', properties: { status: { type: 'string' }, path: { type: 'string' }, previousPath: { type: 'string' } }, required: ['status', 'path'] } },
      },
    },
    handler: async input => {
      const args = objectInput(input);
      if (Array.isArray(args.changedFiles)) {
        return analyzeChangedFiles(args.changedFiles as ChangedFile[], typeof args.base === 'string' ? args.base : 'HEAD~1');
      }
      const root = typeof args.projectRoot === 'string' ? args.projectRoot : process.cwd();
      return collectGitChanges(root, typeof args.base === 'string' ? args.base : 'HEAD~1');
    },
  },
  {
    name: 'android_test_validate_plan',
    description: 'Validate a structured natural-language test plan. Validation is not execution; ambiguous or malformed plans are marked blocked.',
    inputSchema: {
      type: 'object',
      properties: { plan: { type: 'object', description: 'Object with a non-empty goal and explicit steps containing actions.' } },
      required: ['plan'],
    },
    handler: async input => validateTestPlan(objectInput(input).plan),
  },
  {
    name: 'android_test_resolve_instructions',
    description: 'Resolve global, project, feature, and run test instruction layers from least to most specific.',
    inputSchema: {
      type: 'object',
      properties: { layers: { type: 'array', items: { type: 'object', properties: { scope: { type: 'string', enum: ['global', 'project', 'feature', 'run'] }, values: { type: 'object' } }, required: ['scope', 'values'] } },
      required: ['layers'],
    },
    handler: async input => {
      const layers = objectInput(input).layers;
      if (!Array.isArray(layers)) throw new Error('layers must be an array.');
      return resolveInstructions(layers as ScopedInstructions[]);
    },
  },
  {
    name: 'android_test_write_report',
    description: 'Write a redacted Markdown and JSON test report under .android-build-mcp/test-reports/<date>/<time>. Only supplied execution outcomes are reported; this tool does not run tests.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string', description: 'Project root; defaults to the current working directory.' },
        report: { type: 'object', description: 'Report payload with request and optional platform, device, changed files, selected tests, steps, errors, and limitations.' },
      },
      required: ['report'],
    },
    handler: async input => {
      const args = objectInput(input);
      const report = objectInput(args.report) as unknown as TestRunReport;
      if (typeof report.request !== 'string' || !report.request.trim()) throw new Error('report.request must be a non-empty string.');
      const root = typeof args.projectRoot === 'string' ? args.projectRoot : process.cwd();
      return writeTestRunReport(root, report);
    },
  },
];

export function registerTestingIntelligenceTools(register: (tool: ToolDefinition) => void): void {
  for (const tool of testingIntelligenceTools) register(tool);
}
