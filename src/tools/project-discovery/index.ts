import discoverProjects from './discover_projects.js';
import listModules from './list_modules.js';
import listVariants from './list_variants.js';
import showBuildConfig from './show_build_config.js';
import type { ToolModule } from '../types.js';

export const projectDiscoveryTools: ToolModule[] = [discoverProjects, listModules, listVariants, showBuildConfig];
