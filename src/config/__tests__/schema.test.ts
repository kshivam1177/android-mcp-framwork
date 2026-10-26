import { describe, expect, it } from 'vitest';
import { ConfigSchema, DEFAULT_CONFIG } from '../schema.js';
import { WORKFLOWS } from '../../workflows.js';

describe('testing intelligence defaults', () => {
  it('enables testing-intelligence in schema and parsed defaults', () => {
    expect(ConfigSchema.parse({}).enabledWorkflows).toContain('testing-intelligence');
    expect(DEFAULT_CONFIG.enabledWorkflows).toContain('testing-intelligence');
  });

  it('marks the workflow enabled when no config file exists', () => {
    expect(WORKFLOWS.find((workflow) => workflow.name === 'testing-intelligence')?.defaultEnabled).toBe(true);
  });

  it('contains the expected testing tools in the workflow registry', () => {
    const names = WORKFLOWS.find((workflow) => workflow.name === 'testing-intelligence')?.tools.map((tool) => tool.toolName);
    expect(names).toEqual(expect.arrayContaining(['write_test_report', 'analyze_test_project', 'audit_screen', 'save_test_case']));
  });
});
