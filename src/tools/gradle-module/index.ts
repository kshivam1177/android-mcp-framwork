import gradleModuleBuild from './gradle_module_build.js';
import gradleModuleTest from './gradle_module_test.js';
import gradleModuleRun from './gradle_module_run.js';
import gradleModuleStop from './gradle_module_stop.js';
import gradleModuleList from './gradle_module_list.js';
import type { ToolModule } from '../types.js';

export const gradleModuleTools: ToolModule[] = [
  gradleModuleBuild,
  gradleModuleTest,
  gradleModuleRun,
  gradleModuleStop,
  gradleModuleList,
];
