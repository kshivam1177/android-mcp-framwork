import { describe, expect, it } from 'vitest';
import { parseTesseractTsv } from '../screenshotAnalysis.js';

const TSV = [
  'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
  '1\t1\t0\t0\t0\t0\t0\t0\t480\t800\t-1\t',
  '5\t1\t1\t1\t1\t1\t20\t40\t50\t18\t90.5\tSign',
  '5\t1\t1\t1\t1\t2\t76\t40\t25\t18\t88.5\tIn',
  '5\t1\t1\t1\t2\t1\t20\t100\t35\t16\t10\tnoise',
  '',
].join('\n');

describe('parseTesseractTsv', () => {
  it('groups words into lines and returns pixel bounds and centers', () => {
    const result = parseTesseractTsv(TSV);
    expect(result.width).toBe(480);
    expect(result.height).toBe(800);
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).toEqual({
      text: 'Sign In', confidence: 89.5,
      bounds: { left: 20, top: 40, right: 101, bottom: 58 },
      center: { x: 61, y: 49 },
    });
  });

  it('can return individual words and filter by confidence', () => {
    const result = parseTesseractTsv(TSV, { mode: 'word', minConfidence: 80 });
    expect(result.elements.map((item) => item.text)).toEqual(['Sign', 'In']);
    expect(result.elements[0]?.bounds).toEqual({ left: 20, top: 40, right: 70, bottom: 58 });
  });

  it('rejects malformed TSV headers', () => {
    expect(() => parseTesseractTsv('not a TSV header')).toThrow(/expected header columns/i);
  });
});
