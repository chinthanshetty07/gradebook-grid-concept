import { memo, Profiler, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getColumnSummary, getRowSummary, pasteBlock, redo, setScore, undo } from '../store/gradebookSlice.js';
import { perfStore } from '../store/perfStore.js';
import { masteryBand } from '../lib/score.js';
import { parseTSV } from '../lib/tsv.js';
import { getRange } from '../lib/windowing.js';

export const ROW_H = 32;
export const COL_W = 92;
export const HEAD_H = 52;
export const NAME_W = 148;
const OVERSCAN = 4;

const cellId = (r, c) => `cell-${r}-${c}`;

const Row = memo(function Row({ r, row, student, assessments, colStart, colEnd, activeCol, draft }) {
  perfStore.countRow(); // instrumentation: how many rows React re-rendered for the last commit
  const summary = getRowSummary(row, assessments);
  const cells = [];
  for (let c = colStart; c < colEnd; c += 1) {
    const left = NAME_W + c * COL_W;
    const isAverage = c === assessments.length;
    const active = c === activeCol;
    if (isAverage) {
      cells.push(
        <div key={c} id={cellId(r, c)} role="gridcell" aria-readonly="true" aria-colindex={c + 2}
          aria-selected={active} data-r={r} data-c={c} className={`cell avg${active ? ' active' : ''}`}
          style={{ left, width: COL_W }}>
          {summary.avgPct === null ? '' : `${summary.avgPct}%`}
        </div>,
      );
      continue;
    }
    const score = row[c];
    const max = assessments[c].max;
    const band = masteryBand(score, max);
    const editing = active && draft !== null;
    cells.push(
      <div key={c} id={cellId(r, c)} role="gridcell" aria-colindex={c + 2} aria-selected={active}
        aria-label={score === null ? `${assessments[c].title}, empty` : `${assessments[c].title}, ${score} of ${max}, ${band.label}`}
        data-r={r} data-c={c} data-band={band ? band.key : 'none'}
        className={`cell${active ? ' active' : ''}`} style={{ left, width: COL_W }}>
        {editing ? (
          <input className="cell-input" data-edit autoFocus defaultValue={draft} inputMode="decimal"
            aria-label={`Edit ${assessments[c].title} for ${student.name}, maximum ${max}`} />
        ) : (
          <>
            {score}
            {band && <span className="band" aria-hidden="true">{band.short}</span>}
          </>
        )}
      </div>,
    );
  }
  return (
    <div role="row" aria-rowindex={r + 2} className="row" style={{ top: HEAD_H + r * ROW_H, height: ROW_H }}>
      <div role="rowheader" className="name-cell">{student.name}</div>
      {cells}
    </div>
  );
});

export default function Grid({ virtualize = true }) {
  const dispatch = useDispatch();
  const { students, assessments, scores, colSum, colCount } = useSelector((s) => s.gradebook);

  const totalCols = assessments.length + 1; // last column is the read-only row average
  const viewportRef = useRef(null);
  const scrollRaf = useRef(0);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const [size, setSize] = useState({ h: 480, w: 900 });
  const [active, setActive] = useState({ r: 0, c: 0 });
  const [draft, setDraft] = useState(null); // null = not editing
  const draftRef = useRef(null);
  draftRef.current = draft;

  const rowRange = virtualize
    ? getRange({ offset: scroll.top, viewport: size.h, size: ROW_H, total: students.length, overscan: OVERSCAN })
    : { start: 0, end: students.length };
  const colRange = virtualize
    ? getRange({ offset: scroll.left, viewport: size.w, size: COL_W, total: totalCols, overscan: OVERSCAN })
    : { start: 0, end: totalCols };

  useEffect(() => {
    perfStore.setMeta({
      cellsMounted: (rowRange.end - rowRange.start) * (colRange.end - colRange.start),
      totalCells: students.length * totalCols,
    });
  });

  useLayoutEffect(() => {
    const el = viewportRef.current;
    const measure = () => {
      if (el.clientHeight) setSize({ h: el.clientHeight, w: el.clientWidth });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => cancelAnimationFrame(scrollRaf.current), []);

  // Keep the active cell inside the viewport when moving by keyboard.
  const reveal = useCallback((r, c) => {
    const el = viewportRef.current;
    if (!el) return;
    const viewH = el.clientHeight || size.h;
    const viewW = el.clientWidth || size.w;
    if (el.scrollTop > r * ROW_H) el.scrollTop = r * ROW_H;
    else if (el.scrollTop < HEAD_H + (r + 1) * ROW_H - viewH) el.scrollTop = HEAD_H + (r + 1) * ROW_H - viewH;
    if (el.scrollLeft > c * COL_W) el.scrollLeft = c * COL_W;
    else if (el.scrollLeft < NAME_W + (c + 1) * COL_W - viewW) el.scrollLeft = NAME_W + (c + 1) * COL_W - viewW;
  }, [size.h, size.w]);

  const moveTo = useCallback((r, c) => {
    const next = {
      r: Math.min(students.length - 1, Math.max(0, r)),
      c: Math.min(totalCols - 1, Math.max(0, c)),
    };
    setActive(next);
    reveal(next.r, next.c);
  }, [students.length, totalCols, reveal]);

  const focusGrid = () => queueMicrotask(() => viewportRef.current?.focus({ preventScroll: true }));

  const startEdit = (initial) => {
    if (active.c >= assessments.length) return; // the average column is read-only
    setDraft(initial);
  };

  const finishEdit = (value, move) => {
    if (draftRef.current === null) return;
    setDraft(null);
    if (value !== null) {
      perfStore.markEdit();
      dispatch(setScore({ r: active.r, c: active.c, raw: value }));
    }
    if (move) moveTo(active.r + move[0], active.c + move[1]);
    focusGrid();
  };

  const onEditKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finishEdit(e.target.value, [1, 0]); }
    else if (e.key === 'Tab') { e.preventDefault(); finishEdit(e.target.value, [0, e.shiftKey ? -1 : 1]); }
    else if (e.key === 'Escape') { e.preventDefault(); finishEdit(null, null); }
  };

  const onKeyDown = (e) => {
    if (e.target.dataset?.edit !== undefined) {
      onEditKeyDown(e);
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key;
    if (mod && key.toLowerCase() === 'z') { e.preventDefault(); perfStore.markEdit(); dispatch(e.shiftKey ? redo() : undo()); return; }
    if (mod && key.toLowerCase() === 'y') { e.preventDefault(); perfStore.markEdit(); dispatch(redo()); return; }
    const page = Math.max(1, Math.floor(size.h / ROW_H) - 2);
    const moves = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
      PageUp: [-page, 0], PageDown: [page, 0],
    };
    if (moves[key]) { e.preventDefault(); moveTo(active.r + moves[key][0], active.c + moves[key][1]); return; }
    if (key === 'Home') { e.preventDefault(); moveTo(active.r, 0); return; }
    if (key === 'End') { e.preventDefault(); moveTo(active.r, totalCols - 1); return; }
    if (key === 'Enter' || key === 'F2') {
      e.preventDefault();
      const current = scores[active.r][active.c];
      startEdit(current === null || current === undefined ? '' : String(current));
      return;
    }
    if ((key === 'Delete' || key === 'Backspace') && active.c < assessments.length) {
      e.preventDefault();
      perfStore.markEdit();
      dispatch(setScore({ r: active.r, c: active.c, raw: '' }));
      return;
    }
    if (!mod && key.length === 1 && /[0-9.]/.test(key)) { e.preventDefault(); startEdit(key); }
  };

  const onPaste = (e) => {
    if (draftRef.current !== null) return;
    const rows = parseTSV(e.clipboardData?.getData('text') ?? '');
    if (rows.length === 0) return;
    e.preventDefault();
    perfStore.markEdit();
    dispatch(pasteBlock({ r: active.r, c: active.c, rows }));
  };

  const onScroll = (e) => {
    const el = e.currentTarget;
    if (scrollRaf.current) return;
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0;
      setScroll({ top: el.scrollTop, left: el.scrollLeft });
    });
  };

  const onMouseDown = (e) => {
    const cell = e.target.closest('[data-r]');
    if (!cell || e.target.dataset?.edit !== undefined) return;
    if (draftRef.current !== null) finishEdit(viewportRef.current.querySelector('[data-edit]')?.value ?? null, null);
    setActive({ r: Number(cell.dataset.r), c: Number(cell.dataset.c) });
  };

  const onDoubleClick = (e) => {
    const cell = e.target.closest('[data-r]');
    if (!cell || Number(cell.dataset.c) >= assessments.length) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    setActive({ r, c });
    setDraft(scores[r][c] === null ? '' : String(scores[r][c]));
  };

  const headers = [];
  for (let c = colRange.start; c < colRange.end; c += 1) {
    const left = NAME_W + c * COL_W;
    if (c === assessments.length) {
      headers.push(<div key={c} role="columnheader" aria-colindex={c + 2} className="col-head" style={{ left, width: COL_W }}>
        <strong>Average</strong><span>of graded</span></div>);
      continue;
    }
    const summary = getColumnSummary(colSum, colCount, assessments, c);
    headers.push(
      <div key={c} role="columnheader" aria-colindex={c + 2} className="col-head" style={{ left, width: COL_W }}>
        <strong>{assessments[c].title}</strong>
        <span>/{assessments[c].max} · avg {summary.avgPct === null ? '–' : `${summary.avgPct}%`}</span>
      </div>,
    );
  }

  const rows = [];
  for (let r = rowRange.start; r < rowRange.end; r += 1) {
    rows.push(
      <Row key={students[r].id} r={r} row={scores[r]} student={students[r]} assessments={assessments}
        colStart={colRange.start} colEnd={colRange.end}
        activeCol={active.r === r ? active.c : -1} draft={active.r === r ? draft : null} />,
    );
  }

  return (
    <Profiler id="grid" onRender={(_id, _phase, actualDuration) => perfStore.record(actualDuration)}>
      <div ref={viewportRef} className="viewport" role="grid" tabIndex={0}
        aria-label="Gradebook. Arrow keys move, Enter edits, paste from a spreadsheet to fill several cells."
        aria-rowcount={students.length + 1} aria-colcount={totalCols + 1}
        aria-activedescendant={cellId(active.r, active.c)}
        onScroll={onScroll} onKeyDown={onKeyDown} onPaste={onPaste} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick}>
        <div className="canvas" style={{ width: NAME_W + totalCols * COL_W, height: HEAD_H + students.length * ROW_H }}>
          <div role="row" aria-rowindex={1} className="head-row" style={{ height: HEAD_H, width: NAME_W + totalCols * COL_W }}>
            <div role="columnheader" aria-colindex={1} className="corner">Student</div>
            {headers}
          </div>
          {rows}
        </div>
      </div>
    </Profiler>
  );
}
