import type { UiNode } from '../types.js';
import { runAdbForTarget } from '../utils/adb.js';

export interface QaIssue {
  id: string;
  category: 'design' | 'data' | 'responsiveness' | 'exception';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  detail: string;
  elementRef?: string;
  nodeText?: string;
  bounds?: { left: number; top: number; right: number; bottom: number };
  recommendation?: string;
}

export interface QaAuditResult {
  targetId: string;
  packageName?: string;
  timestamp: string;
  elementCount: number;
  healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  summary: string;
  issues: QaIssue[];
  metrics: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
}

export interface ScreenDimensions {
  width: number;
  height: number;
}

function computeOverlapArea(
  b1: { left: number; top: number; right: number; bottom: number },
  b2: { left: number; top: number; right: number; bottom: number }
): number {
  const xOverlap = Math.max(0, Math.min(b1.right, b2.right) - Math.max(b1.left, b2.left));
  const yOverlap = Math.max(0, Math.min(b1.bottom, b2.bottom) - Math.max(b1.top, b2.top));
  return xOverlap * yOverlap;
}

function getArea(b: { left: number; top: number; right: number; bottom: number }): number {
  return Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top);
}

const BROKEN_DATA_REGEX = /\b(null|undefined|NaN|\[object Object\]|lorem ipsum|TODO|dummy)\b/i;
const RAW_ISO_DATE_REGEX = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?\b/;
const RAW_JSON_REGEX = /^(\{|\[)[^]{4,}(\}|\])$/;

/**
 * Pure audit logic that inspects UI nodes and logs without side-effects.
 */
export function analyzeNodes(
  nodes: UiNode[],
  screen: ScreenDimensions = { width: 720, height: 1280 }
): QaIssue[] {
  const issues: QaIssue[] = [];
  let issueCounter = 1;

  const nextId = (prefix: string) => `${prefix}-${issueCounter++}`;

  // 1. Check for RenderFlex overflow in text/contentDesc
  for (const node of nodes) {
    const text = node.text || node.contentDesc || '';
    if (/RenderFlex overflowed by/i.test(text) || /overflowed by \d+/i.test(text)) {
      issues.push({
        id: nextId('DESIGN-OVERFLOW'),
        category: 'design',
        severity: 'CRITICAL',
        title: 'RenderFlex Overflow Visible in UI',
        detail: `Widget has RenderFlex overflow: "${text}"`,
        elementRef: node.ref,
        nodeText: text,
        bounds: node.bounds,
        recommendation: 'Wrap the child in SingleChildScrollView or Expanded/Flexible to prevent UI overflow.',
      });
    }

    // 2. Data checks: null, undefined, NaN, dummy, lorem ipsum
    if (BROKEN_DATA_REGEX.test(text)) {
      issues.push({
        id: nextId('DATA-BROKEN'),
        category: 'data',
        severity: 'CRITICAL',
        title: 'Broken or Placeholder Data in UI',
        detail: `Element displays placeholder/null value: "${text}"`,
        elementRef: node.ref,
        nodeText: text,
        bounds: node.bounds,
        recommendation: 'Check null safety and ensure backend/state properties are initialized before rendering.',
      });
    }

    // 3. Raw ISO timestamp or raw JSON exposed
    if (RAW_ISO_DATE_REGEX.test(text)) {
      issues.push({
        id: nextId('DATA-RAW-DATE'),
        category: 'data',
        severity: 'WARNING',
        title: 'Raw ISO Date String Exposed',
        detail: `Raw timestamp displayed to user: "${text}"`,
        elementRef: node.ref,
        nodeText: text,
        bounds: node.bounds,
        recommendation: 'Format date into human-friendly format (e.g. DD/MM/YYYY or MMM d, y).',
      });
    }

    if (RAW_JSON_REGEX.test(text.trim())) {
      issues.push({
        id: nextId('DATA-RAW-JSON'),
        category: 'data',
        severity: 'WARNING',
        title: 'Raw JSON Exposed in UI',
        detail: `Raw serialized object shown in UI: "${text.slice(0, 80)}..."`,
        elementRef: node.ref,
        nodeText: text,
        bounds: node.bounds,
        recommendation: 'Parse and render individual data fields instead of stringifying objects.',
      });
    }

    // 4. Truncated Text
    if (
      (text.endsWith('...') || text.endsWith('…')) &&
      !/loading|please wait/i.test(text) &&
      text.length > 3
    ) {
      issues.push({
        id: nextId('DESIGN-TRUNCATED'),
        category: 'design',
        severity: 'WARNING',
        title: 'Truncated Text Label',
        detail: `Text appears cut off with ellipsis: "${text}"`,
        elementRef: node.ref,
        nodeText: text,
        bounds: node.bounds,
        recommendation: 'Increase element width, use maxLines with auto-wrap, or allow expanding.',
      });
    }

    // 5. Small Touch Targets for clickable items
    if (node.clickable) {
      const width = node.bounds.right - node.bounds.left;
      const height = node.bounds.bottom - node.bounds.top;
      if (width > 0 && height > 0 && (width < 32 || height < 32)) {
        issues.push({
          id: nextId('DESIGN-TARGET-SIZE'),
          category: 'design',
          severity: 'INFO',
          title: 'Touch Target Below 32px Minimum',
          detail: `Clickable element ${node.ref} (${text || node.className || 'button'}) size is only ${width}x${height}px.`,
          elementRef: node.ref,
          nodeText: text,
          bounds: node.bounds,
          recommendation: 'Increase padding or touch area to at least 48x48dp for reliable accessibility.',
        });
      }
    }

    // 6. Active Spinners / Loading Indicators
    if (
      (node.className && /ProgressBar|CircularProgressIndicator/i.test(node.className)) ||
      /^(loading\.\.\.|please wait\.\.\.)$/i.test(text.trim())
    ) {
      issues.push({
        id: nextId('RESP-LOADER'),
        category: 'responsiveness',
        severity: 'INFO',
        title: 'Active Loading Indicator Present',
        detail: `Element ${node.ref} indicates ongoing background loading: "${text || node.className}"`,
        elementRef: node.ref,
        nodeText: text,
        bounds: node.bounds,
        recommendation: 'Verify the loader completes within a reasonable timeout (< 5s) and does not freeze.',
      });
    }

    // 7. System ANR dialog
    if (/isn't responding/i.test(text) || /(close app|wait)\b/i.test(text)) {
      issues.push({
        id: nextId('RESP-ANR'),
        category: 'responsiveness',
        severity: 'CRITICAL',
        title: 'Application Not Responding (ANR) Dialog Visible',
        detail: `System ANR dialog detected: "${text}"`,
        elementRef: node.ref,
        nodeText: text,
        bounds: node.bounds,
        recommendation: 'Investigate main-thread blocking operations or infinite loops in recent changes.',
      });
    }
  }

  // 8. Overlapping interactive elements
  const clickableNodes = nodes.filter((n) => n.clickable && (n.text || n.contentDesc));
  for (let i = 0; i < clickableNodes.length; i++) {
    for (let j = i + 1; j < clickableNodes.length; j++) {
      const a = clickableNodes[i];
      const b = clickableNodes[j];
      if (!a || !b) continue;
      // Skip if they are exact duplicate coordinates or one completely contains the other as wrapper
      const areaA = getArea(a.bounds);
      const areaB = getArea(b.bounds);
      if (areaA === 0 || areaB === 0) continue;

      const overlap = computeOverlapArea(a.bounds, b.bounds);
      const minArea = Math.min(areaA, areaB);
      const labelA = a.text || a.contentDesc;
      const labelB = b.text || b.contentDesc;
      if (overlap / minArea > 0.4 && labelA !== labelB) {
        issues.push({
          id: nextId('DESIGN-OVERLAP'),
          category: 'design',
          severity: 'WARNING',
          title: 'Overlapping Interactive Elements',
          detail: `Elements "${labelA}" (${a.ref}) and "${labelB}" (${b.ref}) overlap by ${Math.round((overlap / minArea) * 100)}%.`,
          elementRef: a.ref,
          bounds: a.bounds,
          recommendation: 'Review layout constraints to ensure interactive controls do not obscure each other.',
        });
      }
    }
  }

  return issues;
}

/**
 * Inspects device Logcat for crash, flutter error, and API failure signatures.
 */
export async function analyzeLogs(targetId: string, linesCount = 100): Promise<QaIssue[]> {
  const issues: QaIssue[] = [];
  let logOutput = '';
  try {
    const res = await runAdbForTarget(targetId, ['logcat', '-d', '-t', String(linesCount)], { timeoutMs: 5000 });
    logOutput = res.stdout;
  } catch {
    return [];
  }

  const lines = logOutput.split('\n');
  const seenPatterns = new Set<string>();

  for (const line of lines) {
    // 1. RenderFlex overflow in logcat
    if (/RenderFlex overflowed by (\d+(\.\d+)?) pixels/i.test(line)) {
      const match = line.match(/RenderFlex overflowed by (\d+(\.\d+)?) pixels/i);
      const key = `overflow-${match ? match[1] : 'detected'}`;
      if (!seenPatterns.has(key)) {
        seenPatterns.add(key);
        issues.push({
          id: `LOG-OVERFLOW-${seenPatterns.size}`,
          category: 'design',
          severity: 'CRITICAL',
          title: 'Flutter RenderFlex Overflow in Logs',
          detail: line.trim(),
          recommendation: 'Fix layout constraints in Flutter widget hierarchy to eliminate layout overflow.',
        });
      }
    }

    // 2. Fatal Exception
    if (/FATAL EXCEPTION/i.test(line)) {
      if (!seenPatterns.has('fatal-exception')) {
        seenPatterns.add('fatal-exception');
        issues.push({
          id: `LOG-FATAL-${seenPatterns.size}`,
          category: 'exception',
          severity: 'CRITICAL',
          title: 'Fatal Application Crash Detected in Logcat',
          detail: line.trim(),
          recommendation: 'Check crash backtrace and resolve unhandled exception.',
        });
      }
    }

    // 3. Flutter Unhandled Exception
    if (/E\/flutter.*Unhandled Exception/i.test(line) || /NoSuchMethodError/i.test(line)) {
      const key = line.slice(0, 60);
      if (!seenPatterns.has(key)) {
        seenPatterns.add(key);
        issues.push({
          id: `LOG-FLUTTER-ERR-${seenPatterns.size}`,
          category: 'exception',
          severity: 'CRITICAL',
          title: 'Unhandled Flutter Exception',
          detail: line.trim(),
          recommendation: 'Inspect Flutter error log and add appropriate try/catch or null checks.',
        });
      }
    }

    // 4. HTTP 5xx or 4xx Server Errors
    if (/(HTTP\s*(500|502|503|504|404|401|403)|Internal Server Error)/i.test(line)) {
      const key = line.slice(0, 50);
      if (!seenPatterns.has(key)) {
        seenPatterns.add(key);
        issues.push({
          id: `LOG-HTTP-ERR-${seenPatterns.size}`,
          category: 'data',
          severity: 'WARNING',
          title: 'API / Network Error Detected in Logs',
          detail: line.trim(),
          recommendation: 'Verify backend API endpoint availability and request payload format.',
        });
      }
    }
  }

  return issues;
}

/**
 * Complete Screen QA Audit: hierarchy + visual metrics + recent logcat diagnostics.
 */
export async function auditScreen(options: {
  targetId: string;
  nodes: UiNode[];
  screenDimensions?: ScreenDimensions;
  checkLogs?: boolean;
}): Promise<QaAuditResult> {
  const { targetId, nodes, screenDimensions, checkLogs = true } = options;

  const nodeIssues = analyzeNodes(nodes, screenDimensions);
  const logIssues = checkLogs ? await analyzeLogs(targetId) : [];
  const allIssues = [...nodeIssues, ...logIssues];

  const critical = allIssues.filter((i) => i.severity === 'CRITICAL').length;
  const warning = allIssues.filter((i) => i.severity === 'WARNING').length;
  const info = allIssues.filter((i) => i.severity === 'INFO').length;

  const healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' =
    critical > 0 ? 'CRITICAL' : warning > 0 ? 'WARNING' : 'HEALTHY';

  const summary =
    allIssues.length === 0
      ? `Screen on ${targetId} is HEALTHY. No UI responsiveness errors, layout issues, broken data, or logcat exceptions detected.`
      : `Screen on ${targetId} audit found ${allIssues.length} issue(s) [${critical} Critical, ${warning} Warning, ${info} Info]:\n` +
        allIssues.map((i) => `  [${i.severity}] [${i.category.toUpperCase()}] ${i.title}: ${i.detail}`).join('\n');

  return {
    targetId,
    timestamp: new Date().toISOString(),
    elementCount: nodes.length,
    healthStatus,
    summary,
    issues: allIssues,
    metrics: {
      total: allIssues.length,
      critical,
      warning,
      info,
    },
  };
}
