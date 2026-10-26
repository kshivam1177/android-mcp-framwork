import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { AndroidBuildMcpError } from '../../types.js';
import type { ToolModule } from '../types.js';

export const toolName = 'scaffold_android_project';
export const workflow = 'project-scaffolding';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
// build/tools/project-scaffolding/scaffold_android_project.js -> ../../../templates
const TEMPLATE_DIR = path.resolve(moduleDir, '..', '..', '..', 'templates', 'android-project');

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? `{{${key}}}`);
}

function readTemplate(name: string): string {
  return fs.readFileSync(path.join(TEMPLATE_DIR, name), 'utf8');
}

export function register(server: McpServer) {
  return server.registerTool(
    toolName,
    {
      title: 'Scaffold Android Project',
      description:
        "Generate a new minimal Android project (Kotlin + Jetpack Compose, single :app module, AGP 8.6 / Kotlin 2.0) at destinationPath. Ships gradle-wrapper.properties but NOT the wrapper jar binary itself - run `gradle wrapper --gradle-version 8.9` once inside the new project (using any locally-installed Gradle) to generate gradlew/gradlew.bat's actual jar. Fails if destinationPath already exists and isn't empty.",
      inputSchema: {
        destinationPath: z.string(),
        packageName: z.string().describe('e.g. "com.example.myapp"'),
        appName: z.string(),
        minSdk: z.number().optional().describe('Default 24.'),
        targetSdk: z.number().optional().describe('Default 35.'),
        compileSdk: z.number().optional().describe('Default 35.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    withErrorHandling(
      async (args: {
        destinationPath: string;
        packageName: string;
        appName: string;
        minSdk?: number;
        targetSdk?: number;
        compileSdk?: number;
      }) => {
        const dest = path.resolve(args.destinationPath);
        if (fs.existsSync(dest) && fs.readdirSync(dest).length > 0) {
          throw new AndroidBuildMcpError('INVALID_CONFIG', `${dest} already exists and is not empty.`);
        }
        if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(args.packageName)) {
          throw new AndroidBuildMcpError(
            'INVALID_CONFIG',
            `"${args.packageName}" doesn't look like a valid Java/Kotlin package name (expected e.g. "com.example.myapp").`
          );
        }

        const vars: Record<string, string> = {
          PACKAGE_NAME: args.packageName,
          APP_NAME: args.appName,
          MIN_SDK: String(args.minSdk ?? 24),
          TARGET_SDK: String(args.targetSdk ?? 35),
          COMPILE_SDK: String(args.compileSdk ?? 35),
        };
        const packagePath = args.packageName.replace(/\./g, path.sep);

        const write = (relPath: string, content: string): void => {
          const full = path.join(dest, relPath);
          fs.mkdirSync(path.dirname(full), { recursive: true });
          fs.writeFileSync(full, content, 'utf8');
        };

        write('settings.gradle.kts', render(readTemplate('settings.gradle.kts.template'), vars));
        write('build.gradle.kts', render(readTemplate('build.gradle.kts.template'), vars));
        write('gradle.properties', render(readTemplate('gradle.properties.template'), vars));
        write('.gitignore', render(readTemplate('gitignore.template'), vars));
        write('gradle/wrapper/gradle-wrapper.properties', render(readTemplate('gradle/wrapper/gradle-wrapper.properties.template'), vars));
        write('app/build.gradle.kts', render(readTemplate('app_build.gradle.kts.template'), vars));
        write('app/src/main/AndroidManifest.xml', render(readTemplate('AndroidManifest.xml.template'), vars));
        write(path.join('app/src/main/java', packagePath, 'MainActivity.kt'), render(readTemplate('MainActivity.kt.template'), vars));
        write('app/src/main/res/values/strings.xml', render(readTemplate('strings.xml.template'), vars));
        write('app/src/main/res/values/themes.xml', render(readTemplate('themes.xml.template'), vars));

        return textResult(
          `Scaffolded "${args.appName}" (${args.packageName}) at ${dest}.\n\nNext step before it builds: run "gradle wrapper --gradle-version 8.9" inside ${dest} (needs a local Gradle install) to generate the wrapper jar - it isn't bundled.`,
          { destinationPath: dest, packageName: args.packageName }
        );
      }
    )
  );
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
