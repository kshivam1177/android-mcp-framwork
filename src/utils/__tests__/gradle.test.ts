import { describe, it, expect } from 'vitest';
import {
  capitalizeVariant,
  assembleTaskName,
  installTaskName,
  uninstallTaskName,
  unitTestTaskName,
  connectedTestTaskName,
  cleanTaskName,
} from '../gradle.js';

describe('gradle task-name builders', () => {
  it('capitalizes variant names', () => {
    expect(capitalizeVariant('debug')).toBe('Debug');
    expect(capitalizeVariant('devDebug')).toBe('DevDebug');
    expect(capitalizeVariant('')).toBe('');
  });

  it('builds assemble/install/uninstall/test task names for a colon-prefixed module', () => {
    expect(assembleTaskName(':app', 'debug')).toBe(':app:assembleDebug');
    expect(installTaskName(':app', 'debug')).toBe(':app:installDebug');
    expect(uninstallTaskName(':app', 'debug')).toBe(':app:uninstallDebug');
    expect(unitTestTaskName(':app', 'debug')).toBe(':app:testDebugUnitTest');
    expect(connectedTestTaskName(':app', 'debug')).toBe(':app:connectedDebugAndroidTest');
  });

  it('handles nested module paths', () => {
    expect(assembleTaskName(':features:login', 'release')).toBe(':features:login:assembleRelease');
  });

  it('treats root module (":" or "") as no prefix at all', () => {
    expect(assembleTaskName(':', 'debug')).toBe('assembleDebug');
    expect(assembleTaskName('', 'debug')).toBe('assembleDebug');
    expect(cleanTaskName(':')).toBe('clean');
    expect(cleanTaskName(':app')).toBe(':app:clean');
  });

  it('handles flavor+buildType combos', () => {
    expect(assembleTaskName(':app', 'devDebug')).toBe(':app:assembleDevDebug');
  });
});
