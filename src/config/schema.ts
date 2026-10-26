import { z } from 'zod';

export const AndroidBuildMcpConfigSchema = z.object({
  logging: z.object({ level: z.enum(['debug', 'info', 'warn', 'error']).default('info') }).default({}),
  android: z.object({ adbPath: z.string().nullable().default(null), defaultDevice: z.string().nullable().default(null) }).default({}),
  automation: z.object({ backend: z.enum(['adb', 'uiautomator2']).default('adb'), timeoutMs: z.number().int().positive().default(15000) }).default({}),
  reports: z.object({ directory: z.string().default('.androidbuildmcp/test-reports') }).default({}),
});

export type AndroidBuildMcpConfig = z.infer<typeof AndroidBuildMcpConfigSchema>;
