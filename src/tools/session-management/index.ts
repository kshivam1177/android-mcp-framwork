import sessionShowDefaults from './session_show_defaults.js';
import sessionSetDefaults from './session_set_defaults.js';
import sessionClearDefaults from './session_clear_defaults.js';
import sessionUseDefaultsProfile from './session_use_defaults_profile.js';
import type { ToolModule } from '../types.js';

export const sessionManagementTools: ToolModule[] = [
  sessionShowDefaults,
  sessionSetDefaults,
  sessionClearDefaults,
  sessionUseDefaultsProfile,
];
