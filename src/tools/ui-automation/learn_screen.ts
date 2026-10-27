import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { parseUiHierarchy, cacheSnapshot } from '../../automation/uiHierarchy.js';
import { createScreenMap } from '../../automation/screenMap.js';
import { getConfigDir } from '../../config/loader.js';
import { withErrorHandling, textResult } from '../../utils/response.js';
import { getScreenSize, resolveTargetAndBackend } from './_shared.js';
import type { UiNode } from '../../types.js';
import type { ToolModule } from '../types.js';

export const toolName = 'learn_screen';
export const workflow = 'ui-automation';

function elementId(node: UiNode, index: number): string {
  const identity = node.resourceId || node.contentDesc || node.text || node.className || 'element';
  const slug = identity.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'element';
  return `${slug}-${index + 1}`;
}

function selectorFor(node: UiNode): Record<string, string> {
  return {
    ...(node.resourceId ? { resourceId: node.resourceId } : {}),
    ...(node.contentDesc ? { contentDesc: node.contentDesc } : {}),
    ...(node.text ? { text: node.text } : {}),
    ...(node.className ? { className: node.className } : {}),
  };
}

function inputType(node: UiNode): 'text' | 'number' | 'password' | 'unknown' {
  const labels = `${node.contentDesc ?? ''} ${node.text ?? ''}`.toLowerCase();
  if (labels.includes('password')) return 'password';
  if (/phone|mobile|number|numeric/.test(labels) || (node.className ?? '').toLowerCase().includes('number')) return 'number';
  if ((node.className ?? '').toLowerCase().includes('edittext') || node.focusable) return 'text';
  return 'unknown';
}

export function register(server: McpServer) {
  return server.registerTool(toolName, {
    title: 'Learn Screen',
    description: 'Capture the current Android screen once and save a reusable screen definition, screenshot, semantic element selectors, normalized coordinates, and a basic form specification under .androidmcp-framework/screens/<screenId>/.',
    inputSchema: {
      screenId: z.string().min(1).max(80).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/),
      targetId: z.string().optional(),
      projectPath: z.string().optional(),
      tags: z.array(z.string().max(30)).max(10).optional(),
      appRoute: z.string().max(200).optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, withErrorHandling(async (args: {
    screenId: string; targetId?: string; projectPath?: string; tags?: string[]; appRoute?: string;
  }) => {
    const { target, backend } = await resolveTargetAndBackend(args.targetId);
    const [shot, xml, display] = await Promise.all([
      backend.screenshot(target.id),
      backend.dumpHierarchy(target.id),
      getScreenSize(target.id),
    ]);
    const nodes = parseUiHierarchy(xml);
    cacheSnapshot({ targetId: target.id, capturedAt: new Date().toISOString(), backend: backend.name, nodes });
    const interactive = nodes.filter((node) => node.clickable || node.focusable || node.checkable);
    const elements = interactive.map((node, index) => ({
      id: elementId(node, index),
      type: (node.className ?? '').toLowerCase().includes('edittext') ? 'input'
        : (node.className ?? '').toLowerCase().includes('button') ? 'button'
        : node.clickable ? 'link' : 'view',
      selector: selectorFor(node),
      center: { x: node.centerX, y: node.centerY },
      normalizedCenter: {
        x: Number((node.centerX / display.width).toFixed(6)),
        y: Number((node.centerY / display.height).toFixed(6)),
      },
      bounds: node.bounds,
      clickable: node.clickable,
      enabled: node.enabled,
      focusable: node.focusable,
      scrollable: node.scrollable,
      checkable: node.checkable,
      checked: node.checked,
    }));
    const inputs = interactive.filter((node) => (node.className ?? '').toLowerCase().includes('edittext') || node.focusable);
    const fields = inputs.map((node) => {
      const index = interactive.indexOf(node);
      return {
        elementId: elementId(node, index),
        label: node.contentDesc ?? node.text ?? elementId(node, index),
        inputType: inputType(node),
        selector: selectorFor(node),
      };
    });
    const screenTitleNode = nodes.find((node) => (node.text || node.contentDesc) && node.bounds.top < display.height * 0.15 && node.bounds.left < display.width * 0.6);
    const title = screenTitleNode?.contentDesc ?? screenTitleNode?.text ?? args.screenId;
    const projectRoot = path.resolve(args.projectPath ?? process.cwd());
    const screenDir = path.join(getConfigDir(projectRoot), 'screens', args.screenId);
    fs.mkdirSync(screenDir, { recursive: true });
    const extension = shot.mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const screenshotPath = path.join(screenDir, `screenshot.${extension}`);
    const screenMap = createScreenMap({
      screenId: args.screenId, deviceId: target.id, backend: backend.name,
      screenshotPath: path.relative(projectRoot, screenshotPath).split(path.sep).join('/'),
      width: display.width, height: display.height, nodes,
    });
    const screen = {
      schemaVersion: 1, screenId: args.screenId,
      appPackage: nodes.find((node) => node.packageName)?.packageName ?? null,
      title, tags: args.tags ?? [], appRoute: args.appRoute ?? null,
      fingerprint: screenMap.fingerprint, display, capturedAt: new Date().toISOString(),
      deviceId: target.id, backend: backend.name,
      elementCount: elements.length, formFieldCount: fields.length,
    };
    fs.writeFileSync(screenshotPath, shot.data);
    fs.writeFileSync(path.join(screenDir, 'screen.json'), JSON.stringify(screen, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(screenDir, 'elements.json'), JSON.stringify(elements, null, 2) + '\n', 'utf8');
    if (fields.length) fs.writeFileSync(path.join(screenDir, 'form-spec.json'), JSON.stringify({ fields, submitButton: null }, null, 2) + '\n', 'utf8');
    const result = { success: true, screenId: args.screenId, title, fingerprint: screenMap.fingerprint, elementCount: elements.length, formFields: fields.length, savedTo: path.relative(projectRoot, screenDir) };
    return textResult(JSON.stringify(result, null, 2), result);
  }));
}

const mod: ToolModule = { toolName, workflow, register };
export default mod;
