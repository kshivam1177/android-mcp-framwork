import androidCliInfo from './android_cli_info.js';
import androidCliStudioCheck from './android_cli_studio_check.js';
import androidCliStudioAnalyzeFile from './android_cli_studio_analyze_file.js';
import androidCliStudioFindSymbol from './android_cli_studio_find_symbol.js';
import androidCliStudioVersionLookup from './android_cli_studio_version_lookup.js';
import androidCliSkillsList from './android_cli_skills_list.js';
import type { ToolModule } from '../types.js';

export const androidCliTools: ToolModule[] = [
  androidCliInfo,
  androidCliStudioCheck,
  androidCliStudioAnalyzeFile,
  androidCliStudioFindSymbol,
  androidCliStudioVersionLookup,
  androidCliSkillsList,
];
