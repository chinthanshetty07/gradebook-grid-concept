import { createSlice } from '@reduxjs/toolkit';
import { generateDataset } from '../lib/data.js';
import { parseScore } from '../lib/score.js';

const HISTORY_LIMIT = 200;

/**
 * State shape
 *   scores[row][col]  number | null        one array per student, so an edit copies one row only
 *   colSum / colCount per-assessment totals, updated incrementally so class averages are O(1) per edit
 *   past / future     undo stacks of patch groups ({ r, c, prev, next }[]); a paste is one group
 */
export function init(options) {
  const data = generateDataset(options);
  const colSum = Array(data.assessments.length).fill(0);
  const colCount = Array(data.assessments.length).fill(0);
  data.scores.forEach((row) =>
    row.forEach((value, c) => {
      if (value !== null) {
        colSum[c] += value;
        colCount[c] += 1;
      }
    }),
  );
  return { ...data, colSum, colCount, past: [], future: [], notice: '' };
}

function writeCell(state, r, c, next) {
  const prev = state.scores[r][c];
  if (prev === next) return null;
  if (prev !== null) {
    state.colSum[c] -= prev;
    state.colCount[c] -= 1;
  }
  if (next !== null) {
    state.colSum[c] += next;
    state.colCount[c] += 1;
  }
  state.scores[r][c] = next;
  return { r, c, prev, next };
}

const inBounds = (state, r, c) =>
  r >= 0 && r < state.students.length && c >= 0 && c < state.assessments.length;

function record(state, patches) {
  if (patches.length === 0) return;
  state.past.push(patches);
  if (state.past.length > HISTORY_LIMIT) state.past.shift();
  state.future = [];
}

const slice = createSlice({
  name: 'gradebook',
  initialState: () => init({ students: 30, assessments: 10 }),
  reducers: {
    loadDataset: (_state, action) => init(action.payload),

    setScore(state, { payload: { r, c, raw } }) {
      if (!inBounds(state, r, c)) return;
      const result = parseScore(raw, state.assessments[c].max);
      if (!result.ok) {
        state.notice = result.error;
        return;
      }
      const patch = writeCell(state, r, c, result.value);
      if (patch) {
        record(state, [patch]);
        state.notice = `${state.students[r].name}, ${state.assessments[c].title}: ${
          result.value === null ? 'cleared' : result.value
        }`;
      } else {
        state.notice = '';
      }
    },

    pasteBlock(state, { payload: { r, c, rows } }) {
      const patches = [];
      let invalid = 0;
      let clipped = 0;
      rows.forEach((cells, i) =>
        cells.forEach((raw, j) => {
          const tr = r + i;
          const tc = c + j;
          if (!inBounds(state, tr, tc)) {
            clipped += 1;
            return;
          }
          const result = parseScore(raw, state.assessments[tc].max);
          if (!result.ok) {
            invalid += 1;
            return;
          }
          const patch = writeCell(state, tr, tc, result.value);
          if (patch) patches.push(patch);
        }),
      );
      record(state, patches);
      const notes = [];
      if (invalid) notes.push(`${invalid} invalid skipped`);
      if (clipped) notes.push(`${clipped} outside the grid skipped`);
      state.notice = `Pasted ${patches.length} score${patches.length === 1 ? '' : 's'}${
        notes.length ? ` (${notes.join(', ')})` : ''
      }`;
    },

    undo(state) {
      const patches = state.past.pop();
      if (!patches) return;
      [...patches].reverse().forEach((p) => writeCell(state, p.r, p.c, p.prev));
      state.future.push(patches);
      state.notice = `Undid ${patches.length} change${patches.length === 1 ? '' : 's'}`;
    },

    redo(state) {
      const patches = state.future.pop();
      if (!patches) return;
      patches.forEach((p) => writeCell(state, p.r, p.c, p.next));
      state.past.push(patches);
      state.notice = `Redid ${patches.length} change${patches.length === 1 ? '' : 's'}`;
    },
  },
});

export const { loadDataset, setScore, pasteBlock, undo, redo } = slice.actions;
export default slice.reducer;

// Row summaries are cached against the row array itself. Immer keeps untouched rows
// referentially identical, so an edit invalidates exactly one row's summary.
const rowCache = new WeakMap();

export function getRowSummary(row, assessments) {
  const hit = rowCache.get(row);
  if (hit && hit.assessments === assessments) return hit.value;
  let sum = 0;
  let graded = 0;
  row.forEach((score, c) => {
    if (score !== null) {
      sum += score / assessments[c].max;
      graded += 1;
    }
  });
  const value = { graded, avgPct: graded ? Math.round((sum / graded) * 1000) / 10 : null };
  rowCache.set(row, { assessments, value });
  return value;
}

export function getColumnSummary(colSum, colCount, assessments, c) {
  const graded = colCount[c];
  return {
    graded,
    avgPct: graded ? Math.round((colSum[c] / graded / assessments[c].max) * 1000) / 10 : null,
  };
}
