import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export type NpmRunner = (args: string[], inheritOutput?: boolean) => string;

export function isPathInsideDirectory(candidatePath: string, parentPath: string): boolean {
  const relative = path.relative(path.resolve(parentPath), path.resolve(candidatePath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function readPackageVersion(packageJsonText: string): string | undefined {
  try {
    const parsed = JSON.parse(packageJsonText) as { version?: unknown };
    return typeof parsed.version === 'string' && parsed.version.trim() ? parsed.version : undefined;
  } catch {
    return undefined;
  }
}

function defaultNpmRunner(args: string[], inheritOutput = false): string {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const output = execFileSync(command, args, {
    encoding: 'utf8',
    stdio: inheritOutput ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    // npm is a .cmd shim on Windows. All arguments here are fixed by this module.
    shell: process.platform === 'win32',
  });
  return typeof output === 'string' ? output.trim() : '';
}

function canonicalPath(candidate: string): string {
  try {
    return fs.realpathSync(candidate);
  } catch {
    return path.resolve(candidate);
  }
}

export interface UpdateResult {
  success: boolean;
  currentVersion?: string;
  latestVersion?: string;
  installedVersion?: string;
  message: string;
}

/**
 * Update the global npm installation in place. npm install replaces the old
 * package version; npm cache clean is intentionally explicit because npm's
 * content-addressed cache is shared with unrelated Node.js projects.
 */
export function runSelfUpdate(
  packageRoot: string,
  runner: NpmRunner = defaultNpmRunner,
  log: (message: string) => void = console.log,
): UpdateResult {
  let currentVersion: string | undefined;
  try {
    currentVersion = readPackageVersion(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  } catch {
    // The global root check below will provide the actionable error.
  }

  let globalRoot: string;
  try {
    globalRoot = runner(['root', '--global']);
  } catch {
    return { success: false, currentVersion, message: 'Could not locate the global npm installation. Ensure npm is installed and available on PATH.' };
  }

  const resolvedPackageRoot = canonicalPath(packageRoot);
  const resolvedGlobalRoot = canonicalPath(globalRoot);
  const relative = path.relative(resolvedGlobalRoot, resolvedPackageRoot);
  const insideGlobalRoot = relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  if (!insideGlobalRoot) {
    const message = 'This command is not running from the global npm installation. Install it globally first with: npm install -g androidmcp-framework@latest';
    log(message);
    return { success: false, currentVersion, message };
  }

  let latestVersion: string;
  try {
    latestVersion = runner(['view', 'androidmcp-framework', 'version']).trim();
    if (!latestVersion) throw new Error('empty version response');
  } catch {
    const message = 'Could not reach the npm registry to determine the latest version. No update was attempted.';
    log(message);
    return { success: false, currentVersion, message };
  }

  log(`Updating androidmcp-framework: ${currentVersion ?? 'unknown'} -> ${latestVersion}...`);
  try {
    runner(['install', '--global', 'androidmcp-framework@latest'], true);
  } catch {
    const message = 'npm could not install the latest version. The existing installation was not deliberately uninstalled first; check npm permissions/network and retry.';
    log(message);
    return { success: false, currentVersion, latestVersion, message };
  }

  let cacheWarning = '';
  try {
    runner(['cache', 'clean', '--force'], true);
  } catch {
    cacheWarning = ' Warning: the package was updated, but npm cache cleanup failed.';
  }

  let installedVersion: string | undefined;
  try {
    const output = runner(['list', '--global', '--depth=0', '--json']);
    const parsed = JSON.parse(output) as {
      dependencies?: Record<string, { version?: string }>;
    };
    installedVersion = parsed.dependencies?.['androidmcp-framework']?.version;
  } catch {
    // Verify from the package directory if npm list output is unavailable.
    try {
      const installedPackageJson = path.join(globalRoot, 'androidmcp-framework', 'package.json');
      installedVersion = readPackageVersion(fs.readFileSync(installedPackageJson, 'utf8'));
    } catch {
      // Keep the verification failure visible in the result below.
    }
  }

  if (!installedVersion) {
    const message = 'The install command completed, but the installed version could not be verified.' + cacheWarning;
    log(message);
    return { success: false, currentVersion, latestVersion, message };
  }
  if (installedVersion !== latestVersion) {
    const message = `Installed version ${installedVersion} does not match npm's latest version ${latestVersion}. Retry the update and inspect npm permissions or registry configuration.` + cacheWarning;
    log(message);
    return { success: false, currentVersion, latestVersion, installedVersion, message };
  }

  const message = `Updated androidmcp-framework to ${installedVersion}. The previous globally installed version was replaced.` +
    ' npm cache cleanup was attempted (this clears npm cache entries for all projects, not just AndroidMCP Framework).' + cacheWarning;
  log(message);
  return { success: true, currentVersion, latestVersion, installedVersion, message };
}
