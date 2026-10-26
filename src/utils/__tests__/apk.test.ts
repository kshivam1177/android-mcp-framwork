import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { moduleDirFromPath } from '../apk.js';

describe('moduleDirFromPath', () => {
  const root = path.join('/', 'home', 'user', 'MyApp');

  it('maps a top-level module to a direct subdirectory', () => {
    expect(moduleDirFromPath(root, ':app')).toBe(path.join(root, 'app'));
  });

  it('maps a nested module path to nested directories', () => {
    expect(moduleDirFromPath(root, ':features:login')).toBe(path.join(root, 'features', 'login'));
  });

  it('maps the root module (":" or "") to the project root itself', () => {
    expect(moduleDirFromPath(root, ':')).toBe(root);
    expect(moduleDirFromPath(root, '')).toBe(root);
  });
});
