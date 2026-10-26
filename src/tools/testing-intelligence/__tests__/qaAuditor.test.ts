import { describe, it, expect } from 'vitest';
import { analyzeNodes, auditScreen } from '../../../automation/qaAuditor.js';
import type { UiNode } from '../../../types.js';

describe('QA Auditor: analyzeNodes and auditScreen', () => {
  const baseNode: UiNode = {
    ref: 'e1',
    index: 0,
    bounds: { left: 50, top: 100, right: 250, bottom: 160 },
    centerX: 150,
    centerY: 130,
    clickable: true,
    enabled: true,
    focusable: true,
    scrollable: false,
    checkable: false,
    checked: false,
    depth: 1,
  };

  it('detects RenderFlex overflow in widget text', () => {
    const nodes: UiNode[] = [
      {
        ...baseNode,
        ref: 'e1',
        text: 'A RenderFlex overflowed by 48 pixels on the bottom.',
      },
    ];

    const issues = analyzeNodes(nodes);
    expect(issues.some((i) => i.category === 'design' && i.severity === 'CRITICAL')).toBe(true);
    expect(issues[0]?.title).toContain('RenderFlex');
  });

  it('detects broken / placeholder data values (null, undefined, NaN)', () => {
    const nodes: UiNode[] = [
      {
        ...baseNode,
        ref: 'e1',
        text: 'Order Total: null',
      },
      {
        ...baseNode,
        ref: 'e2',
        bounds: { left: 50, top: 200, right: 250, bottom: 260 },
        text: 'Price: NaN',
      },
      {
        ...baseNode,
        ref: 'e3',
        bounds: { left: 50, top: 300, right: 250, bottom: 360 },
        text: 'Lorem ipsum dolor sit amet',
      },
    ];

    const issues = analyzeNodes(nodes);
    const dataIssues = issues.filter((i) => i.category === 'data');
    expect(dataIssues).toHaveLength(3);
    expect(dataIssues.every((i) => i.severity === 'CRITICAL')).toBe(true);
  });

  it('detects truncated text ending with ellipsis', () => {
    const nodes: UiNode[] = [
      {
        ...baseNode,
        ref: 'e1',
        text: 'Executive High-Back Ergonomic Office Cha...',
      },
    ];

    const issues = analyzeNodes(nodes);
    expect(issues.some((i) => i.title === 'Truncated Text Label')).toBe(true);
  });

  it('detects small touch targets under 32px for clickable elements', () => {
    const nodes: UiNode[] = [
      {
        ...baseNode,
        ref: 'e1',
        bounds: { left: 10, top: 10, right: 25, bottom: 25 }, // 15x15 px
        clickable: true,
        text: 'x',
      },
    ];

    const issues = analyzeNodes(nodes);
    expect(issues.some((i) => i.title.includes('Touch Target'))).toBe(true);
  });

  it('detects overlapping interactive elements', () => {
    const nodes: UiNode[] = [
      {
        ...baseNode,
        ref: 'e1',
        bounds: { left: 100, top: 100, right: 300, bottom: 200 },
        clickable: true,
        text: 'Save Order',
      },
      {
        ...baseNode,
        ref: 'e2',
        bounds: { left: 120, top: 110, right: 320, bottom: 210 }, // heavy overlap
        clickable: true,
        text: 'Cancel Order',
      },
    ];

    const issues = analyzeNodes(nodes);
    expect(issues.some((i) => i.title === 'Overlapping Interactive Elements')).toBe(true);
  });

  it('returns HEALTHY status when screen is clean', async () => {
    const nodes: UiNode[] = [
      {
        ...baseNode,
        ref: 'e1',
        text: 'Your Cart',
        bounds: { left: 100, top: 50, right: 400, bottom: 120 },
      },
      {
        ...baseNode,
        ref: 'e2',
        text: 'Proceed to Checkout',
        bounds: { left: 50, top: 600, right: 670, bottom: 680 },
      },
    ];

    const audit = await auditScreen({
      targetId: 'dummy-target',
      nodes,
      checkLogs: false,
    });

    expect(audit.healthStatus).toBe('HEALTHY');
    expect(audit.metrics.total).toBe(0);
    expect(audit.summary).toContain('HEALTHY');
  });
});

