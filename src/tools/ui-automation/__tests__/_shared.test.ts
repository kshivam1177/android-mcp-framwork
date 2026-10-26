import { describe, it, expect } from 'vitest';
import { directionToCoords } from '../_shared.js';

describe('directionToCoords', () => {
  const screen = { width: 1000, height: 2000 };

  it('computes an upward swipe from below-center to above-center', () => {
    const { startX, startY, endX, endY } = directionToCoords('up', screen, 0.6);
    expect(startX).toBe(500);
    expect(endX).toBe(500);
    expect(startY).toBeGreaterThan(endY);
  });

  it('computes a rightward swipe from left-of-center to right-of-center', () => {
    const { startX, endX, startY, endY } = directionToCoords('right', screen, 0.5);
    expect(startY).toBe(1000);
    expect(endY).toBe(1000);
    expect(endX).toBeGreaterThan(startX);
  });

  it('keeps the swipe within the screen bounds for a full-distance gesture', () => {
    const { startX, startY, endX, endY } = directionToCoords('down', screen, 1);
    for (const v of [startX, endX]) expect(v).toBeGreaterThanOrEqual(0);
    for (const v of [startY, endY]) expect(v).toBeLessThanOrEqual(screen.height);
  });
});
