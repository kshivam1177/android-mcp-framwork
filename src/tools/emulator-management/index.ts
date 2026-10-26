import listAvds from './list_avds.js';
import createAvd from './create_avd.js';
import deleteAvd from './delete_avd.js';
import bootEmulator from './boot_emulator.js';
import eraseEmulator from './erase_emulator.js';
import setEmulatorLocation from './set_emulator_location.js';
import setEmulatorAppearance from './set_emulator_appearance.js';
import emulatorStatusbar from './emulator_statusbar.js';
import openEmulator from './open_emulator.js';
import recordEmulatorVideo from './record_emulator_video.js';
import type { ToolModule } from '../types.js';

export const emulatorManagementTools: ToolModule[] = [
  listAvds,
  createAvd,
  deleteAvd,
  bootEmulator,
  eraseEmulator,
  setEmulatorLocation,
  setEmulatorAppearance,
  emulatorStatusbar,
  openEmulator,
  recordEmulatorVideo,
];
