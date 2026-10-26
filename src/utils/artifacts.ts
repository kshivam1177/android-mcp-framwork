import fs from 'node:fs';
import path from 'node:path';
import { getConfigDir } from '../config/loader.js';
import { resolveProjectRoot } from './paths.js';

/**
 * Create a path for generated evidence that belongs to an application project.
 * Artifact categories are single path segments to prevent path traversal.
 * Existing evidence is never silently replaced; a numeric suffix is added.
 */
export function createArtifactPath(projectRoot: string, category: string, fileName: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(category)) {
    throw new Error(`Invalid artifact category: ${category}`);
  }

  const safeFileName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!safeFileName || safeFileName === '.' || safeFileName === '..') {
    throw new Error('Artifact file name must be a non-empty file name.');
  }

  const resolvedProjectRoot = resolveProjectRoot(path.resolve(projectRoot));
  const configDir = getConfigDir(resolvedProjectRoot);
  const artifactDir = path.join(configDir, 'artifacts', category);
  fs.mkdirSync(artifactDir, { recursive: true });

  const extension = path.extname(safeFileName);
  const stem = extension ? safeFileName.slice(0, -extension.length) : safeFileName;
  let candidate = path.join(artifactDir, safeFileName);
  let suffix = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(artifactDir, `${stem}-${suffix++}${extension}`);
  }
  return candidate;
}

/** Create a filesystem-safe, timestamped artifact name. */
export function timestampedArtifactName(prefix: string, extension: string, date = new Date()): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeExtension = extension.replace(/^\.+/, '').replace(/[^a-zA-Z0-9]/g, '');
  const timestamp = date.toISOString().replace(/[:.]/g, '-');
  return `${safePrefix}-${timestamp}.${safeExtension}`;
}
