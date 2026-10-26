import fs from 'node:fs';
import path from 'node:path';
import { getStateDir, resolveProjectRoot } from '../utils/paths.js';
import { findFlutterProjectRoot } from '../utils/projectDiscovery.js';
import { loadConfig } from '../config/loader.js';
import type { SessionDefaults } from '../config/schema.js';

function sessionDir(): string {
  const dir = path.join(getStateDir(), 'session-defaults');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function activeProfilePath(): string {
  return path.join(sessionDir(), 'active-profile.txt');
}

function profileFilePath(profile: string): string {
  const safe = profile.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(sessionDir(), `${safe}.json`);
}

export function getActiveProfileName(): string {
  try {
    const contents = fs.readFileSync(activeProfilePath(), 'utf8').trim();
    return contents || 'default';
  } catch {
    return 'default';
  }
}

export function useProfile(profile: string): void {
  fs.writeFileSync(activeProfilePath(), profile, 'utf8');
}

/** Runtime overrides for one profile, layered on top of config.yaml's static
 * sessionDefaults. Empty until session_set_defaults has been called at least
 * once for that profile. */
function readProfileOverrides(profile: string): Partial<SessionDefaults> {
  try {
    const raw = fs.readFileSync(profileFilePath(profile), 'utf8');
    return JSON.parse(raw) as Partial<SessionDefaults>;
  } catch {
    return {};
  }
}

function writeProfileOverrides(profile: string, overrides: Partial<SessionDefaults>): void {
  fs.writeFileSync(profileFilePath(profile), JSON.stringify(overrides, null, 2), 'utf8');
}

export interface EffectiveSessionDefaults {
  profile: string;
  defaults: SessionDefaults;
  disabled: boolean;
  source: 'config-only' | 'config+overrides';
}

function resolveProjectPath(defaults: SessionDefaults): SessionDefaults {
  const workspaceRoot = resolveProjectRoot(process.cwd());
  const configured = defaults.projectPath?.trim();
  const candidate = configured
    ? path.resolve(path.isAbsolute(configured) ? configured : path.join(workspaceRoot, configured))
    : undefined;

  const hasGradleSettings = (dir: string) =>
    fs.existsSync(path.join(dir, 'settings.gradle')) || fs.existsSync(path.join(dir, 'settings.gradle.kts'));
  const hasPubspec = (dir: string) => fs.existsSync(path.join(dir, 'pubspec.yaml'));

  // Keep an explicitly configured project root when it is a recognizable
  // Gradle or Flutter root. A legacy "./app" module path is normalized to the
  // workspace Gradle root instead of being treated as the Gradle root itself.
  if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    if (hasGradleSettings(candidate) || hasPubspec(candidate)) {
      return { ...defaults, projectPath: candidate };
    }
    if (hasGradleSettings(workspaceRoot)) {
      return { ...defaults, projectPath: workspaceRoot };
    }
  }

  if (hasGradleSettings(workspaceRoot)) {
    return { ...defaults, projectPath: workspaceRoot };
  }
  const flutterRoot = findFlutterProjectRoot(candidate && fs.existsSync(candidate) ? candidate : workspaceRoot);
  if (flutterRoot) return { ...defaults, projectPath: flutterRoot };
  return { ...defaults, projectPath: candidate ?? workspaceRoot };
}

export function getEffectiveSessionDefaults(): EffectiveSessionDefaults {
  const config = loadConfig();
  const profile = getActiveProfileName();
  if (config.disableSessionDefaults) {
    return {
      profile,
      defaults: resolveProjectPath(config.sessionDefaults),
      disabled: true,
      source: 'config-only',
    };
  }
  const overrides = readProfileOverrides(profile);
  const hasOverrides = Object.keys(overrides).length > 0;
  const defaults = resolveProjectPath({ ...config.sessionDefaults, ...overrides });
  return {
    profile,
    defaults,
    disabled: false,
    source: hasOverrides ? 'config+overrides' : 'config-only',
  };
}mport fs from 'node:fs';
import path from 'node:path';
import { getStateDir, resolveProjectRoot } from '../utils/paths.js';
import { findFlutterProjectRoot } from '../utils/projectDiscovery.js';
import { loadConfig } from '../config/loader.js';
import type { SessionDefaults } from '../config/schema.js';

function sessionDir(): string {
  const dir = path.join(getStateDir(), 'session-defaults');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function activeProfilePath(): string {
  return path.join(sessionDir(), 'active-profile.txt');
}

function profileFilePath(profile: string): string {
  const safe = profile.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(sessionDir(), `${safe}.json`);
}

export function getActiveProfileName(): string {
  try {
    const contents = fs.readFileSync(activeProfilePath(), 'utf8').trim();
    return contents || 'default';
  } catch {
    return 'default';
  }
}

export function useProfile(profile: string): void {
  fs.writeFileSync(activeProfilePath(), profile, 'utf8');
}

/** Runtime overrides for one profile, layered on top of config.yaml's static
 * sessionDefaults. Empty until session_set_defaults has been called at least
 * once for that profile. */
function readProfileOverrides(profile: string): Partial<SessionDefaults> {
  try {
    const raw = fs.readFileSync(profileFilePath(profile), 'utf8');
    return JSON.parse(raw) as Partial<SessionDefaults>;
  } catch {
    return {};
  }
}

function writeProfileOverrides(profile: string, overrides: Partial<SessionDefaults>): void {
  fs.writeFileSync(profileFilePath(profile), JSON.stringify(overrides, null, 2), 'utf8');
}

export interface EffectiveSessionDefaults {
  profile: string;
  defaults: SessionDefaults;
  disabled: boolean;
  source: 'config-only' | 'config+overrides';
}

export function getEffectiveSessionDefaults(): EffectiveSessionDefaults {
  const config = loadConfig();
  const profile = getActiveProfileName();
  if (config.disableSessionDefaults) {
    return { profile, defaults: config.sessionDefaults, disabled: true, source: 'config-only' };
  }
  const overrides = readProfileOverrides(profile);
  const hasOverrides = Object.keys(overrides).length > 0;
  return {
    profile,
    defaults: { ...config.sessionDefaults, ...overrides },
    disabled: false,
    source: hasOverrides ? 'config+overrides' : 'config-only',
  };
}

export function setSessionDefaults(patch: Partial<SessionDefaults>): SessionDefaults {
  const profile = getActiveProfileName();
  const current = readProfileOverrides(profile);
  const next = { ...current, ...patch };
  writeProfileOverrides(profile, next);
  return getEffectiveSessionDefaults().defaults;
}

export function clearSessionDefaults(profile?: string): void {
  const target = profile ?? getActiveProfileName();
  const file = profileFilePath(target);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function listProfiles(): string[] {
  const dir = sessionDir();
  const active = getActiveProfileName();
  const stored = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
  return Array.from(new Set([...stored, active, 'default']));
}
