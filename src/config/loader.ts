import { readFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { AndroidBuildMcpConfigSchema, type AndroidBuildMcpConfig } from './schema.js';

const cache = new Map<string, AndroidBuildMcpConfig>();

export async function loadConfig(configPath = 'config.yaml'): Promise<AndroidBuildMcpConfig> {
  const resolved = path.resolve(configPath);
  const existing = cache.get(resolved);
  if (existing) return existing;
  try {
    const source = await readFile(resolved, 'utf8');
    const config = AndroidBuildMcpConfigSchema.parse(YAML.parse(source));
    cache.set(resolved, config);
    return config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const config = AndroidBuildMcpConfigSchema.parse({});
      cache.set(resolved, config);
      return config;
    }
    throw error;
  }
}

export function clearConfigCache(): void { cache.clear(); }
