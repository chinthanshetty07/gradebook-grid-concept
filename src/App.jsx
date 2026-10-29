import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Grid from './components/Grid.jsx';
import PerfPanel from './components/PerfPanel.jsx';
import { loadDataset, redo, undo } from './store/gradebookSlice.js';
import { BANDS } from './lib/score.js';

const SIZES = {
  small: { label: 'Small class: 30 × 10', students: 30, assessments: 10 },
  class: { label: 'Large cohort: 200 × 30', students: 200, assessments: 30 },
  stress: { label: 'Stress test: 1,000 × 60', students: 1000, assessments: 60 },
};

export default function App() {
  const dispatch = useDispatch();
  const notice = useSelector((s) => s.gradebook.notice);
  const canUndo = useSelector((s) => s.gradebook.past.length > 0);
  const canRedo = useSelector((s) => s.gradebook.future.length > 0);
  const [size, setSize] = useState('class');
  const [virtualize, setVirtualize] = useState(true);

  return (
    <main>
      <header>
        <h1>Gradebook grid concept</h1>
        <p className="disclaimer">
          An independent, speculative prototype built from public product information. Not an official project of any
          company. All data is synthetic.
        </p>
      </header>

      <section className="controls" aria-label="Demo controls">
        <label>
          Dataset
          <select value={size} onChange={(e) => { setSize(e.target.value); dispatch(loadDataset(SIZES[e.target.value])); }}>
            {Object.entries(SIZES).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={virtualize} onChange={(e) => setVirtualize(e.target.checked)} />
          Virtualize (render only visible cells)
        </label>
        <button type="button" onClick={() => dispatch(undo())} disabled={!canUndo}>Undo</button>
        <button type="button" onClick={() => dispatch(redo())} disabled={!canRedo}>Redo</button>
      </section>

      {!virtualize && size === 'stress' && (
        <p className="warning" role="alert">
          Virtualization is off: this renders all 61,000 cells, so scrolling and editing will be slow. That is the point of the comparison.
        </p>
      )}

      <PerfPanel />
      <Grid virtualize={virtualize} />

      <p role="status" aria-live="polite" className="notice">{notice}</p>

      <footer>
        <ul className="legend" aria-label="Mastery bands">
          {BANDS.map((b) => (
            <li key={b.key}><span className={`swatch ${b.key}`}>{b.short}</span> {b.label} ({Math.round(b.min * 100)}%+)</li>
          ))}
        </ul>
        <p className="help">
          Keys: arrows / Tab move · Enter or typing edits · Esc cancels · Delete clears · Ctrl/Cmd+Z undo, Shift+Z or Y redo ·
          paste TSV from a spreadsheet to fill a block.
        </p>
      </footer>
    </main>
  );
}
