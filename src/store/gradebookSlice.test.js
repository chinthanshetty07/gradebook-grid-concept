import { describe, expect, it } from 'vitest';
import reducer, { getColumnSummary, getRowSummary, init, loadDataset, pasteBlock, redo, setScore, undo } from './gradebookSlice.js';

const empty = () => reducer(undefined, loadDataset({ students: 4, assessments: 3, fillRate: 0 }));
// assessment maxima for the first three columns are 10, 20, 25

function recomputeColumn(state, c) {
  let sum = 0, count = 0;
  state.scores.forEach((row) => { if (row[c] !== null) { sum += row[c]; count += 1; } });
  return { sum, count };
}

describe('setScore', () => {
  it('stores a valid score and updates the column aggregate without rescanning', () => {
    const s = reducer(empty(), setScore({ r: 1, c: 1, raw: '15' }));
    expect(s.scores[1][1]).toBe(15);
    expect(s.colSum[1]).toBe(15);
    expect(s.colCount[1]).toBe(1);
  });

  it('rejects out-of-range input and says why', () => {
    const s = reducer(empty(), setScore({ r: 0, c: 0, raw: '11' }));
    expect(s.scores[0][0]).toBeNull();
    expect(s.notice).toBe('11 is above the maximum of 10');
    expect(s.past).toHaveLength(0);
  });

  it('clearing a score removes it from the aggregate', () => {
    let s = reducer(empty(), setScore({ r: 0, c: 0, raw: '8' }));
    s = reducer(s, setScore({ r: 0, c: 0, raw: '' }));
    expect(s.scores[0][0]).toBeNull();
    expect(s.colCount[0]).toBe(0);
  });

  it('does not record history when nothing changed', () => {
    let s = reducer(empty(), setScore({ r: 0, c: 0, raw: '8' }));
    s = reducer(s, setScore({ r: 0, c: 0, raw: '8' }));
    expect(s.past).toHaveLength(1);
  });

  it('only creates a new array for the edited row (structural sharing)', () => {
    const before = empty();
    const after = reducer(before, setScore({ r: 2, c: 0, raw: '5' }));
    expect(after.scores[2]).not.toBe(before.scores[2]);
    expect(after.scores[0]).toBe(before.scores[0]);
    expect(after.scores[3]).toBe(before.scores[3]);
  });
});

describe('aggregates stay correct under any sequence of edits', () => {
  it('matches a full recomputation after edits, pastes, undo and redo', () => {
    let s = reducer(undefined, loadDataset({ students: 25, assessments: 6, seed: 11 }));
    s = reducer(s, setScore({ r: 3, c: 2, raw: '12.5' }));
    s = reducer(s, pasteBlock({ r: 0, c: 0, rows: [['4', '9', '11'], ['1', '2', '3']] }));
    s = reducer(s, setScore({ r: 7, c: 4, raw: '' }));
    s = reducer(s, undo());
    s = reducer(s, undo());
    s = reducer(s, redo());
    for (let c = 0; c < 6; c += 1) {
      const expected = recomputeColumn(s, c);
      expect(s.colCount[c]).toBe(expected.count);
      expect(s.colSum[c]).toBeCloseTo(expected.sum, 6);
    }
  });
});

describe('undo and redo', () => {
  it('reverses and reapplies a single edit', () => {
    let s = reducer(empty(), setScore({ r: 0, c: 0, raw: '6' }));
    s = reducer(s, undo());
    expect(s.scores[0][0]).toBeNull();
    s = reducer(s, redo());
    expect(s.scores[0][0]).toBe(6);
  });

  it('a new edit clears the redo stack', () => {
    let s = reducer(empty(), setScore({ r: 0, c: 0, raw: '6' }));
    s = reducer(s, undo());
    s = reducer(s, setScore({ r: 0, c: 0, raw: '7' }));
    expect(s.future).toHaveLength(0);
  });

  it('undo with nothing to undo is a no-op', () => {
    const s = empty();
    expect(reducer(s, undo())).toEqual(s);
  });
});

describe('pasteBlock', () => {
  it('fills a block from the active cell and undoes as one step', () => {
    let s = reducer(empty(), pasteBlock({ r: 1, c: 0, rows: [['7', '8'], ['9', '10']] }));
    expect([s.scores[1][0], s.scores[1][1], s.scores[2][0], s.scores[2][1]]).toEqual([7, 8, 9, 10]);
    expect(s.notice).toBe('Pasted 4 scores');
    s = reducer(s, undo());
    expect([s.scores[1][0], s.scores[2][1]]).toEqual([null, null]);
  });

  it('skips invalid values and cells outside the grid, and reports both', () => {
    const s = reducer(empty(), pasteBlock({ r: 3, c: 2, rows: [['5', '6'], ['7', '8']] }));
    // rows: only (3,2) exists and 5 <= 25; (3,3) (4,*) are outside the grid
    expect(s.scores[3][2]).toBe(5);
    expect(s.notice).toBe('Pasted 1 score (3 outside the grid skipped)');
    const bad = reducer(empty(), pasteBlock({ r: 0, c: 0, rows: [['99', 'x', '3']] }));
    expect(bad.notice).toBe('Pasted 1 score (2 invalid skipped)');
  });
});

describe('summaries', () => {
  it('row summary averages the share of each maximum and is cached per row array', () => {
    let s = reducer(empty(), setScore({ r: 0, c: 0, raw: '5' })); // 50%
    s = reducer(s, setScore({ r: 0, c: 1, raw: '20' }));          // 100%
    expect(getRowSummary(s.scores[0], s.assessments)).toEqual({ graded: 2, avgPct: 75 });
    expect(getRowSummary(s.scores[0], s.assessments)).toBe(getRowSummary(s.scores[0], s.assessments));
    expect(getRowSummary(s.scores[1], s.assessments)).toEqual({ graded: 0, avgPct: null });
  });

  it('column summary is a percentage of the assessment maximum', () => {
    let s = reducer(empty(), setScore({ r: 0, c: 2, raw: '10' }));
    s = reducer(s, setScore({ r: 1, c: 2, raw: '20' }));
    expect(getColumnSummary(s.colSum, s.colCount, s.assessments, 2)).toEqual({ graded: 2, avgPct: 60 });
  });

  it('init builds aggregates that match the generated scores', () => {
    const s = init({ students: 15, assessments: 5, seed: 2 });
    for (let c = 0; c < 5; c += 1) expect(s.colCount[c]).toBe(recomputeColumn(s, c).count);
  });
});
