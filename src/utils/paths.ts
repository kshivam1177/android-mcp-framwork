import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Cross-platform, per-user state directory for runtime state that isn't
 * project config: session-default overrides, log-capture buffers, cached
 * workflow-discovery results. Project config (.android-build-mcp/config.yaml)
 * is separate and lives per-project - never write project config here.
 */
export function getStateDir(): string {
  const platform = process.platform;
  let base: string;
  if (platform === 'darwin') {
    base = path.join(os.homedir(), 'Library', 'Application Support', 'androidbuildmcp');
  } else if (platform === 'win32') {
    base = path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'androidbuildmcp');
  } else {
    base = path.join(process.env.XDG_STATE_HOME ?? path.join(os.homedir(), '.local', 'state'), 'androidbuildmcp');
  }
  fs.mkdirSync(base, { recursive: true });
  return base;
}

/**
 * Render an absolute path relative to cwd (or ~) for user-facing tool text -
 * never surface a raw multi-directory absolute path when a shorter,
 * recognizable form exists.
 */
export function displayPath(absolutePath: string, cwd: string = process.cwd()): string {
  const rel = path.relative(cwd, absolutePath);
  if (rel === '') return '.';
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
    return rel;
  }
  const home = os.homedir();
  if (absolutePath.startsWith(home)) {
    return path.join('~', path.relative(home, absolutePath));
  }
  return absolutePath;
}

/** Walk upward from startDir looking for .android-build-mcp/config.yaml (or legacy .androidbuildmcp/config.yaml). */
export function findProjectConfigPath(startDir: string = process.cwd()): string | null {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate1 = path.join(dir, '.android-build-mcp', 'config.yaml');
    if (fs.existsSync(candidate1)) return candidate1;
    const candidate2 = path.join(dir, '.androidbuildmcp', 'config.yaml');
    if (fs.existsSync(candidate2)) return candidate2;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}


