import { describe, expect, it } from 'vitest';
import { generateDataset } from './data.js';
import { masteryBand, parseScore } from './score.js';
import { parseTSV } from './tsv.js';
import { getRange } from './windowing.js';

describe('parseScore', () => {
  it('treats blank as clearing the cell', () => {
    expect(parseScore('  ', 10)).toEqual({ ok: true, value: null });
  });
  it('accepts integers and up to two decimals within the maximum', () => {
    expect(parseScore('7', 10)).toEqual({ ok: true, value: 7 });
    expect(parseScore('9.25', 10)).toEqual({ ok: true, value: 9.25 });
    expect(parseScore('10', 10)).toEqual({ ok: true, value: 10 });
  });
  it('rejects text, negatives, extra decimals and scores above the maximum, with a reason', () => {
    for (const bad of ['abc', '-1', '1.234', '1e3']) expect(parseScore(bad, 10).ok).toBe(false);
    expect(parseScore('11', 10)).toEqual({ ok: false, error: '11 is above the maximum of 10' });
  });
});

describe('masteryBand', () => {
  it('maps share of the maximum to bands at the boundaries', () => {
    expect(masteryBand(3.9, 10).key).toBe('beginning');
    expect(masteryBand(4, 10).key).toBe('developing');
    expect(masteryBand(6, 10).key).toBe('proficient');
    expect(masteryBand(8, 10).key).toBe('mastered');
    expect(masteryBand(null, 10)).toBeNull();
  });
});

describe('parseTSV', () => {
  it('splits rows and columns and ignores one trailing newline', () => {
    expect(parseTSV('1\t2\r\n3\t4\r\n')).toEqual([['1', '2'], ['3', '4']]);
  });
  it('returns nothing for empty input', () => {
    expect(parseTSV('')).toEqual([]);
    expect(parseTSV('\n')).toEqual([]);
  });
  it('keeps empty cells so columns stay aligned', () => {
    expect(parseTSV('1\t\t3')).toEqual([['1', '', '3']]);
  });
});

describe('getRange', () => {
  it('covers the viewport plus overscan, clamped to the list', () => {
    expect(getRange({ offset: 0, viewport: 100, size: 10, total: 1000, overscan: 2 })).toEqual({ start: 0, end: 12 });
    expect(getRange({ offset: 500, viewport: 100, size: 10, total: 1000, overscan: 2 })).toEqual({ start: 48, end: 62 });
    expect(getRange({ offset: 9950, viewport: 100, size: 10, total: 1000, overscan: 2 }).end).toBe(1000);
  });
  it('handles an empty list', () => {
    expect(getRange({ offset: 0, viewport: 100, size: 10, total: 0 })).toEqual({ start: 0, end: 0 });
  });
});

describe('generateDataset', () => {
  it('is deterministic for a seed and respects each assessment maximum', () => {
    const a = generateDataset({ students: 20, assessments: 8, seed: 3 });
    expect(generateDataset({ students: 20, assessments: 8, seed: 3 })).toEqual(a);
    a.scores.forEach((row) => row.forEach((v, c) => v === null || expect(v).toBeLessThanOrEqual(a.assessments[c].max)));
  });
});
