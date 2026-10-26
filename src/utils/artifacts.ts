import fs from 'node:fs';
import path from 'node:path';
import { getConfigDir } from '../config/loader.js';

/**
 * Create a path for generated evidence that belongs to an application project.
 * Artifact categories are single path segments to prevent path traversal.
 */
export function createArtifactPath(projectRoot: string, category: string, fileName: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(category)) {
    throw new Error(`Invalid artifact category: ${category}`);
  }

  const safeFileName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!safeFileName || safeFileName === '.' || safeFileName === '..') {
    throw new Error('Artifact file name must be a non-empty file name.');
  }

  const configDir = getConfigDir(path.resolve(projectRoot));
  const artifactDir = path.join(configDir, 'artifacts', category);
  fs.mkdirSync(artifactDir, { recursive: true });
  return path.join(artifactDir, safeFileName);
}

/** Create a filesystem-safe, timestamped artifact name. */
export function timestampedArtifactName(prefix: string, extension: string, date = new Date()): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeExtension = extension.replace(/^\.+/, '').replace(/[^a-zA-Z0-9]/g, '');
  const timestamp = date.toISOString().replace(/[:.]/g, '-');
  return `${safePrefix}-${timestamp}.${safeExtension}`;
}
