import { z } from 'zod';

// Older project configs may still say `auto` or `uiautomator2`.
// Normalize those legacy values to the supported ADB-only backend instead of
// making existing projects fail config parsing after the Python helper removal.
export const AutomationBackendSchema = z.enum(['adb', 'uiautomator2', 'auto']).transform(() => 'adb' as const);

export const SessionDefaultsSchema = z
  .object({
    projectPath: z.string().nullable().optional(),
    module: z.string().nullable().optional(),
    variant: z.string().nullable().optional(),
    targetId: z.string().nullable().optional(),
    avdName: z.string().nullable().optional(),
    applicationId: z.string().nullable().optional(),
    gradleTaskPrefix: z.string().nullable().optional(),
  })
  .default({});

export const PathsSchema = z
  .object({
    adbPath: z.string().default('adb'),
    gradlePath: z.string().nullable().default(null),
    androidHome: z.string().nullable().default(null),
    javaHome: z.string().nullable().default(null),
    androidCliPath: z.string().default('android'),
  })
  .default({});

export const ConfigSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  enabledWorkflows: z
    .array(z.string())
    .default(['device', 'ui-automation', 'session-management', 'doctor', 'workflow-discovery']),
  customWorkflows: z.record(z.array(z.string())).default({}),
  automationBackend: AutomationBackendSchema.default('adb'),
  disableSessionDefaults: z.boolean().default(false),
  debug: z.boolean().default(false),
  sessionDefaults: SessionDefaultsSchema,
  paths: PathsSchema,
});

export type Config = z.infer<typeof ConfigSchema>;
export type SessionDefaults = z.infer<typeof SessionDefaultsSchema>;
export type PathsConfig = z.infer<typeof PathsSchema>;

export const DEFAULT_CONFIG: Config = ConfigSchema.parse({});
