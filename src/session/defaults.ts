import fs from 'node:fs';
import path from 'node:path';
import { getStateDir } from '../utils/paths.js';
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
