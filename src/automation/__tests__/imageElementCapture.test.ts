import { describe, expect, it } from 'vitest';
import { mapOcrWordsToNodes, parseTesseractTsv } from '../imageElementCapture.js';
import type { UiNode } from '../../types.js';

const node = (ref: string, bounds: UiNode['bounds']): UiNode => ({
  ref, index: 0, bounds,
  centerX: Math.round((bounds.left + bounds.right) / 2),
  centerY: Math.round((bounds.top + bounds.bottom) / 2),
  clickable: true, enabled: true, focusable: false, scrollable: false,
  checkable: false, checked: false, depth: 1,
});

describe('screenshot OCR element capture', () => {
  it('parses Tesseract TSV, scales coordinates, and filters low confidence words', () => {
    const tsv = [
      'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
      '5\t1\t1\t1\t1\t1\t20\t30\t80\t20\t92.5\tContinue',
      '5\t1\t1\t1\t1\t2\t10\t10\t5\t5\t12\tnoise',
    ].join('\n');
    const words = parseTesseractTsv(tsv, 0.5, 0.5, 45);
    expect(words).toHaveLength(1);
    expect(words[0]?.text).toBe('Continue');
    expect(words[0]?.bounds).toEqual({ left: 10, top: 15, right: 50, bottom: 25 });
    expect(words[0]?.confidence).toBe(92.5);
  });

  it('maps OCR words to the smallest containing semantic element', () => {
    const words = parseTesseractTsv([
      'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
      '5\t1\t1\t1\t1\t1\t30\t30\t40\t20\t90\tContinue',
    ].join('\n'));
    const nodes = [
      node('parent', { left: 0, top: 0, right: 200, bottom: 100 }),
      node('button', { left: 20, top: 20, right: 100, bottom: 70 }),
    ];
    expect(mapOcrWordsToNodes(words, nodes)[0]?.matchedElementRef).toBe('button');
  });

  it('leaves OCR words unmatched when outside all element bounds', () => {
    const words = parseTesseractTsv([
      'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
      '5\t1\t1\t1\t1\t1\t300\t300\t30\t20\t88\tOutside',
    ].join('\n'));
    expect(mapOcrWordsToNodes(words, [node('button', { left: 0, top: 0, right: 100, bottom: 100 })])[0]?.matchedElementRef).toBeUndefined();
  });
});
