import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ConfigSchema, DEFAULT_CONFIG } from './schema.js';
import type { Config } from './schema.js';
import { findProjectConfigPath, PROJECT_CONFIG_DIR } from '../utils/paths.js';
import { AndroidBuildMcpError } from '../types.js';

let cachedConfig: Config | null = null;
let cachedConfigPath: string | null | undefined = undefined;

export interface LoadConfigOptions {
  configPath?: string;
  cwd?: string;
  forceReload?: boolean;
}

export function loadConfig(options: LoadConfigOptions = {}): Config {
  const resolvedPath = options.configPath ?? findProjectConfigPath(options.cwd);

  if (!options.forceReload && cachedConfigPath !== undefined && cachedConfigPath === resolvedPath) {
    return cachedConfig ?? DEFAULT_CONFIG;
  }

  if (!resolvedPath) {
    cachedConfig = DEFAULT_CONFIG;
    cachedConfigPath = null;
    return cachedConfig;
  }

  let raw: unknown;
  try {
    const fileContents = fs.readFileSync(resolvedPath, 'utf8');
    raw = parseYaml(fileContents) ?? {};
  } catch (err) {
    throw new AndroidBuildMcpError(
      'INVALID_CONFIG',
      `Could not read or parse ${resolvedPath}: ${(err as Error).message}`,
      { path: resolvedPath }
    );
  }

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new AndroidBuildMcpError('INVALID_CONFIG', `Invalid config at ${resolvedPath}: ${issues}`, {
      path: resolvedPath,
    });
  }

  cachedConfig = result.data;
  cachedConfigPath = resolvedPath;
  return cachedConfig;
}

export function getConfigPath(cwd: string = process.cwd()): string {
  return findProjectConfigPath(cwd) ?? path.join(cwd, PROJECT_CONFIG_DIR, 'config.yaml');
}

export function getConfigDir(cwd: string = process.cwd()): string {
  const configPath = findProjectConfigPath(cwd);
  return configPath ? path.dirname(configPath) : path.join(cwd, PROJECT_CONFIG_DIR);
}

/** Mostly for tests: drop the cache so the next loadConfig() re-reads disk. */
export function resetConfigCache(): void {
  cachedConfig = null;
  cachedConfigPath = undefined;
}
