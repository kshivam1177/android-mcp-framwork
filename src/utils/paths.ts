import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export const PROJECT_CONFIG_DIR = '.androidmcp-framework';
const LEGACY_CONFIG_DIRS = ['.android-build-mcp', '.androidbuildmcp'] as const;

/**
 * Cross-platform, per-user state directory for runtime state that isn't
 * project config: session-default overrides, log-capture buffers, cached
 * workflow-discovery results. Project config remains project-scoped.
 */
export function getStateDir(): string {
  const platform = process.platform;
  let base: string;
  if (platform === 'darwin') {
    base = path.join(os.homedir(), 'Library', 'Application Support', 'androidmcp-framework');
  } else if (platform === 'win32') {
    base = path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'androidmcp-framework');
  } else {
    base = path.join(process.env.XDG_STATE_HOME ?? path.join(os.homedir(), '.local', 'state'), 'androidmcp-framework');
  }
  fs.mkdirSync(base, { recursive: true });
  return base;
}

export function displayPath(absolutePath: string, cwd: string = process.cwd()): string {
  const rel = path.relative(cwd, absolutePath);
  if (rel === '') return '.';
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) return rel;
  const home = os.homedir();
  if (absolutePath.startsWith(home)) return path.join('~', path.relative(home, absolutePath));
  return absolutePath;
}

/**
 * Find the canonical config first, while continuing to read either legacy
 * directory so existing projects do not lose access to their saved settings.
 */
export function findProjectConfigPath(startDir: string = process.cwd()): string | null {
  let dir = path.resolve(startDir);
  for (;;) {
    const canonical = path.join(dir, PROJECT_CONFIG_DIR, 'config.yaml');
    if (fs.existsSync(canonical)) return canonical;
    for (const legacyName of LEGACY_CONFIG_DIRS) {
      const legacy = path.join(dir, legacyName, 'config.yaml');
      if (fs.existsSync(legacy)) return legacy;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
