import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createScreenMap } from '../../automation/screenMap.js';
import { parseUiHierarchy } from '../../automation/uiHierarchy.js';
import { getConfigDir } from '../../config/loader.js';
import { runAdbShell } from '../../utils/adb.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { getScreenSize, resolveTargetAndBackend } from './_shared.js';
import type { UiNode } from '../../types.js';
import type { ToolModule } from '../types.js';

export const toolName = 'interact_screen';
export const workflow = 'ui-automation';

type LearnedElement = {
  id: string;
  selector: Record<string, string>;
  center: { x: number; y: number };
  normalizedCenter: { x: number; y: number };
};

function matches(node: UiNode, selector: Record<string, string>): boolean {
  return Object.entries(selector).every(([key, value]) => {
    const actual = key === 'resourceId' ? node.resourceId
      : key === 'contentDesc' ? node.contentDesc
      : key === 'className' ? node.className
      : key === 'text' ? node.text : undefined;
    return actual === value;
  });
}

function findNode(nodes: UiNode[], element: LearnedElement): UiNode | undefined {
  const semantic = nodes.find((node) => matches(node, element.selector));
  return semantic ?? nodes.find((node) => node.centerX === element.center.x && node.centerY === element.center.y);
}

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Interact with Learned Screen',
    description: 'Execute a bounded sequence of actions against a previously learned screen without returning to the LLM between each action. Verifies the starting fingerprint by default and returns per-action results plus an optional final screenshot.',
    inputSchema: {
      screenId: z.string().min(1).max(80).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/),
      actions: z.array(z.object({
        type: z.enum(['tap', 'type', 'clear_and_type', 'select', 'scroll_to', 'wait', 'back', 'hide_keyboard']),
        elementId: z.string().optional(),
        value: z.string().optional(),
        waitMs: z.number().min(0).max(30_000).optional(),
      })).min(1).max(50),
      captureAfter: z.boolean().optional().default(true),
      verifyScreen: z.boolean().optional().default(true),
      targetId: z.string().optional(),
      projectPath: z.string().optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, withErrorHandling(async (args: {
    screenId: string;
    actions: Array<{ type: 'tap'|'type'|'clear_and_type'|'select'|'scroll_to'|'wait'|'back'|'hide_keyboard'; elementId?: string; value?: string; waitMs?: number }>;
    captureAfter?: boolean; verifyScreen?: boolean; targetId?: string; projectPath?: string;
  }) => {
    const projectRoot = path.resolve(args.projectPath ?? process.cwd());
    const screenDir = path.join(getConfigDir(projectRoot), 'screens', args.screenId);
    const screenPath = path.join(screenDir, 'screen.json');
    const elementsPath = path.join(screenDir, 'elements.json');
    if (!fs.existsSync(screenPath) || !fs.existsSync(elementsPath)) {
      throw new Error(`Screen "${args.screenId}" has not been learned. Call learn_screen first.`);
    }
    const screen = JSON.parse(fs.readFileSync(screenPath, 'utf8')) as { fingerprint: string; display: { width: number; height: number } };
    const elements = JSON.parse(fs.readFileSync(elementsPath, 'utf8')) as LearnedElement[];
    const { target, backend } = await resolveTargetAndBackend(args.targetId);
    let nodes = parseUiHierarchy(await backend.dumpHierarchy(target.id));
    const display = await getScreenSize(target.id);
    if (args.verifyScreen !== false) {
      const current = createScreenMap({ screenId: args.screenId, deviceId: target.id, backend: backend.name, screenshotPath: '', width: display.width, height: display.height, nodes });
      if (current.fingerprint !== screen.fingerprint) {
        throw new Error(`Current screen does not match learned screen "${args.screenId}". Re-run learn_screen for the current layout or pass verifyScreen=false deliberately.`);
      }
    }
    const results: Array<{ index: number; type: string; status: 'ok'|'failed'; durationMs: number; message?: string }> = [];
    for (let i = 0; i < args.actions.length; i++) {
      const action = args.actions[i]!;
      const started = Date.now();
      try {
        if (action.type === 'wait') {
          await new Promise((resolve) => setTimeout(resolve, action.waitMs ?? 500));
        } else if (action.type === 'back') {
          await backend.keyEvent(target.id, '4');
        } else if (action.type === 'hide_keyboard') {
          await backend.keyEvent(target.id, '111');
        } else {
          if (!action.elementId) throw new Error(`${action.type} requires elementId.`);
          let element = elements.find((item) => item.id === action.elementId);
          if (!element) throw new Error(`Unknown elementId "${action.elementId}" in learned screen.`);
          if (action.type === 'scroll_to') {
            let found = findNode(nodes, element);
            for (let attempt = 0; !found && attempt < 8; attempt++) {
              await backend.swipe(target.id, display.width / 2, display.height * 0.78, display.width / 2, display.height * 0.30, 350);
              nodes = parseUiHierarchy(await backend.dumpHierarchy(target.id));
              found = findNode(nodes, element);
            }
            if (!found) throw new Error(`Could not find element "${action.elementId}" after scrolling.`);
            await backend.tap(target.id, found.centerX, found.centerY);
          } else {
            const node = findNode(nodes, element);
            const x = node?.centerX ?? Math.round(element.normalizedCenter.x * display.width);
            const y = node?.centerY ?? Math.round(element.normalizedCenter.y * display.height);
            if (action.type === 'tap' || action.type === 'select') {
              await backend.tap(target.id, x, y);
            } else {
              if (action.value === undefined) throw new Error(`${action.type} requires value.`);
              await backend.tap(target.id, x, y);
              if (action.type === 'clear_and_type') {
                await backend.keyEvent(target.id, 'KEYCODE_MOVE_END');
                await runAdbShell(target.id, ['input', 'keyevent', ...Array.from({ length: 100 }, () => 'KEYCODE_DEL')], { timeoutMs: 15_000 });
              }
              await backend.typeText(target.id, action.value);
            }
          }
        }
        results.push({ index: i, type: action.type, status: 'ok', durationMs: Date.now() - started });
      } catch (error) {
        results.push({ index: i, type: action.type, status: 'failed', durationMs: Date.now() - started, message: error instanceof Error ? error.message : String(error) });
        break;
      }
    }
    let screenshotPath: string | null = null;
    if (args.captureAfter !== false) {
      const shot = await backend.screenshot(target.id);
      const dir = path.join(getConfigDir(projectRoot), 'artifacts', 'screenshots');
      fs.mkdirSync(dir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      screenshotPath = path.join(dir, `${args.screenId}-${timestamp}.png`);
      fs.writeFileSync(screenshotPath, shot.data);
    }
    const result = { success: results.length === args.actions.length && results.every((item) => item.status === 'ok'), screenId: args.screenId, screenVerified: args.verifyScreen !== false, actionsExecuted: results.length, actionResults: results, screenshotPath: screenshotPath ? path.relative(projectRoot, screenshotPath) : null };
    return textResult(JSON.stringify(result, null, 2), result);
  }));
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
