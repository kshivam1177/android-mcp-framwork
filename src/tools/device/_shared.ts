import path from 'node:path';
import { getEffectiveSessionDefaults } from '../../session/defaults.js';
import { AndroidBuildMcpError } from '../../types.js';

export interface ResolvedBuildParams {
  projectPath: string;
  module: string;
  variant: string;
}

export interface BuildParamArgs {
  projectPath?: string;
  module?: string;
  variant?: string;
}

/** Explicit arg wins; falls back to the active session-default profile;
 * fails loudly (never silently picks a guessed value) if still missing. */
export function resolveBuildParams(args: BuildParamArgs): ResolvedBuildParams {
  const defaults = getEffectiveSessionDefaults().defaults;
  const projectPath = args.projectPath ?? defaults.projectPath ?? undefined;
  const module = args.module ?? defaults.module ?? undefined;
  const variant = args.variant ?? defaults.variant ?? undefined;

  const missing = [!projectPath && 'projectPath', !module && 'module', !variant && 'variant'].filter(
    (v): v is string => Boolean(v)
  );
  if (missing.length > 0) {
    throw new AndroidBuildMcpError(
      'INVALID_CONFIG',
      `Missing ${missing.join(', ')}. Pass it explicitly, set sessionDefaults in .android-build-mcp/config.yaml, or call session_set_defaults first.`
    );
  }
  return {
    projectPath: path.resolve(projectPath as string),
    module: module as string,
    variant: variant as string,
  };
}
