import startLogCapture from './start_log_capture.js';
import stopLogCapture from './stop_log_capture.js';
import getCrashReport from './get_crash_report.js';
import getAnrTrace from './get_anr_trace.js';
import clearLogs from './clear_logs.js';
import bugReport from './bug_report.js';
import type { ToolModule } from '../types.js';

export const debuggingTools: ToolModule[] = [
  startLogCapture,
  stopLogCapture,
  getCrashReport,
  getAnrTrace,
  clearLogs,
  bugReport,
];
