import analyzeTestProject from './analyze_test_project.js';
import saveTestInstructions from './save_test_instructions.js';
import writeTestReport from './write_test_report.js';
import saveTestCase from './save_test_case.js';
import listTestCases from './list_test_cases.js';
import auditScreen from './audit_screen.js';
import runTestCase from './run_test_case.js';
import type { ToolModule } from '../types.js';

export const testingIntelligenceTools: ToolModule[] = [
  analyzeTestProject,
  saveTestInstructions,
  writeTestReport,
  saveTestCase,
  listTestCases,
  auditScreen,
  runTestCase,
];
