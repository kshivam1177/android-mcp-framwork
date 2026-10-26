import { deviceTools } from './tools/device/index.js';
import { emulatorManagementTools } from './tools/emulator-management/index.js';
import { uiAutomationTools } from './tools/ui-automation/index.js';
import { debuggingTools } from './tools/debugging/index.js';
import { projectDiscoveryTools } from './tools/project-discovery/index.js';
import { projectScaffoldingTools } from './tools/project-scaffolding/index.js';
import { gradleModuleTools } from './tools/gradle-module/index.js';
import { sessionManagementTools } from './tools/session-management/index.js';
import { doctorTools } from './tools/doctor/index.js';
import { workflowDiscoveryTools } from './tools/workflow-discovery/index.js';
import { androidCliTools } from './tools/android-cli/index.js';
import { testingIntelligenceTools } from './tools/testing-intelligence/index.js';
import type { ToolModule } from './tools/types.js';

export interface WorkflowDefinition {
  name: string;
  description: string;
  /** Enabled out of the box when no config.yaml exists at all. */
  defaultEnabled: boolean;
  tools: ToolModule[];
}

export const WORKFLOWS: WorkflowDefinition[] = [
  {
    name: 'device',
    description:
      "Build, install, launch, stop, test, and transfer files to/from Android targets - emulators and physical devices together, since adb doesn't distinguish the way Xcode's simctl/devicectl split does.",
    defaultEnabled: true,
    tools: deviceTools,
  },
  {
    name: 'emulator-management',
    description: 'Create, boot, wipe, and configure AVDs: location, dark/light appearance, status-bar demo mode, screen recording.',
    defaultEnabled: false,
    tools: emulatorManagementTools,
  },
  {
    name: 'ui-automation',
    description: 'Semantic UI snapshots, screenshot OCR coordinates, selector-based form filling, and tap/swipe/drag/type/key/gesture/wait/batch.',
    defaultEnabled: true,
    tools: uiAutomationTools,
  },
  {
    name: 'debugging',
    description: 'Logcat streaming, crash and ANR extraction, log clearing, full adb bugreport. Log/crash-focused by design - no JDWP breakpoint debugging in this version.',
    defaultEnabled: false,
    tools: debuggingTools,
  },
  {
    name: 'project-discovery',
    description: 'Find Gradle project roots, list modules and build variants, inspect build configuration.',
    defaultEnabled: false,
    tools: projectDiscoveryTools,
  },
  {
    name: 'project-scaffolding',
    description: 'Generate a new minimal Kotlin + Compose Android project from a bundled template.',
    defaultEnabled: false,
    tools: projectScaffoldingTools,
  },
  {
    name: 'gradle-module',
    description:
      'Build/test/run/list/stop a standalone Gradle module (pure-JVM/Kotlin library or CLI) - the roughest analogy in this project to Xcode\'s swift-package workflow; Android has no exact equivalent to a runnable SPM target.',
    defaultEnabled: false,
    tools: gradleModuleTools,
  },
  {
    name: 'session-management',
    description: 'View, set, clear, and switch between named session-default profiles (projectPath/module/variant/targetId/...).',
    defaultEnabled: true,
    tools: sessionManagementTools,
  },
  {
    name: 'doctor',
    description: 'Environment diagnostics: adb, java, gradle, Android SDK, emulator, optional uiautomator2 bridge.',
    defaultEnabled: true,
    tools: doctorTools,
  },
  {
    name: 'android-cli',
    description: 'Optional integration with Google Android CLI 1.0+: environment info, Android Studio semantic analysis/navigation, dependency version lookup, and Android skills discovery. Android CLI is installed separately.',
    defaultEnabled: false,
    tools: androidCliTools,
  },
  {
    name: 'testing-intelligence',
    description: 'Project test discovery, saved test cases/instructions, screen QA audits, change-impact analysis, layered instruction resolution, plan validation, and test reports',
    defaultEnabled: false,
    tools: testingIntelligenceTools,
  },
  {
    name: 'workflow-discovery',
    description: 'List and toggle which workflows are enabled for this running server session.',
    defaultEnabled: true,
    tools: workflowDiscoveryTools,
  },
];

export function getWorkflow(name: string): WorkflowDefinition | undefined {
  return WORKFLOWS.find((w) => w.name === name);
}

export function getAllToolModules(): ToolModule[] {
  return WORKFLOWS.flatMap((w) => w.tools);
}
