import { useSyncExternalStore } from 'react';
import { perfStore } from '../store/perfStore.js';

export default function PerfPanel() {
  const p = useSyncExternalStore(perfStore.subscribe, perfStore.getSnapshot);
  const fmt = (ms) => (ms === null ? '–' : `${ms.toFixed(1)} ms`);
  return (
    <dl className="perf" aria-label="Render performance measured with the React Profiler">
      <div><dt>Cells in the DOM</dt><dd>{p.cellsMounted.toLocaleString()} of {p.totalCells.toLocaleString()}</dd></div>
      <div><dt>Last edit: React render</dt><dd>{fmt(p.lastEditMs)}</dd></div>
      <div><dt>Last edit: keypress to painted</dt><dd>{fmt(p.lastEditPaintMs)}</dd></div>
      <div><dt>Rows re-rendered by it</dt><dd>{p.lastEditRows ?? '–'}</dd></div>
      <div><dt>Last commit (any cause)</dt><dd>{fmt(p.lastCommitMs)}</dd></div>
    </dl>
  );
}
