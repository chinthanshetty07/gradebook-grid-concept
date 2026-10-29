// A tiny external store so a performance panel can show React Profiler numbers
// without being part of the tree it measures.
let snapshot = {
  commits: 0,
  lastCommitMs: 0,
  lastEditMs: null,
  lastEditRows: null,
  lastEditPaintMs: null,
  rowsRendered: 0,
  cellsMounted: 0,
  totalCells: 0,
};
let rowCounter = 0;
let editPending = false;
let editStart = 0;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export const perfStore = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => snapshot,
  countRow() {
    rowCounter += 1;
  },
  markEdit() {
    editPending = true;
    editStart = performance.now();
  },
  record(ms) {
    snapshot = { ...snapshot, commits: snapshot.commits + 1, lastCommitMs: ms, rowsRendered: rowCounter };
    if (editPending) {
      snapshot.lastEditMs = ms;
      snapshot.lastEditRows = rowCounter;
      editPending = false;
      // Profiler durations can be below timer resolution, so also measure what a user feels:
      // keypress until the frame that shows the change has been painted.
      const started = editStart;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          snapshot = { ...snapshot, lastEditPaintMs: performance.now() - started };
          emit();
        }),
      );
    }
    rowCounter = 0;
    emit();
  },
  setMeta(meta) {
    if (meta.cellsMounted === snapshot.cellsMounted && meta.totalCells === snapshot.totalCells) return;
    snapshot = { ...snapshot, ...meta };
    emit();
  },
};
