import listDevices from './list_devices.js';
import buildDevice from './build_device.js';
import buildRunDevice from './build_run_device.js';
import installAppDevice from './install_app_device.js';
import launchAppDevice from './launch_app_device.js';
import stopAppDevice from './stop_app_device.js';
import uninstallAppDevice from './uninstall_app_device.js';
import clearAppDataDevice from './clear_app_data_device.js';
import testDevice from './test_device.js';
import pushFileDevice from './push_file_device.js';
import pullFileDevice from './pull_file_device.js';
import type { ToolModule } from '../types.js';

export const deviceTools: ToolModule[] = [
  listDevices,
  buildDevice,
  buildRunDevice,
  installAppDevice,
  launchAppDevice,
  stopAppDevice,
  uninstallAppDevice,
  clearAppDataDevice,
  testDevice,
  pushFileDevice,
  pullFileDevice,
];
