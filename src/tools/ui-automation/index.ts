import snapshotUi from './snapshot_ui.js';
import tap from './tap.js';
import longPress from './long_press.js';
import swipe from './swipe.js';
import drag from './drag.js';
import typeText from './type_text.js';
import keyPress from './key_press.js';
import hideKeyboard from './hide_keyboard.js';
import button from './button.js';
import gesture from './gesture.js';
import screenshot from './screenshot.js';
import analyzeScreenImage from './analyze_screen_image.js';
import analyzeScreenshot from './analyze_screenshot.js';
import fillForm from './fill_form.js';
import runUiWorkflow from './run_ui_workflow.js';
import waitForUi from './wait_for_ui.js';
import batch from './batch.js';
import touch from './touch.js';
import type { ToolModule } from '../types.js';

export const uiAutomationTools: ToolModule[] = [
  snapshotUi,
  tap,
  longPress,
  swipe,
  drag,
  typeText,
  keyPress,
  hideKeyboard,
  button,
  gesture,
  screenshot,
  analyzeScreenImage,
  analyzeScreenshot,
  fillForm,
  runUiWorkflow,
  waitForUi,
  batch,
  touch,
];
