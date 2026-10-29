import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import App from '../App.jsx';
import Grid from './Grid.jsx';
import { makeStore } from '../store/store.js';

const setup = (options, props = {}) => {
  const store = makeStore({ fillRate: 0, ...options });
  render(<Provider store={store}><Grid {...props} /></Provider>);
  return { store, grid: screen.getByRole('grid') };
};

const cell = (r, c) => document.getElementById(`cell-${r}-${c}`);

describe('Grid', () => {
  it('exposes grid semantics with total row and column counts', () => {
    const { grid } = setup({ students: 5, assessments: 3 });
    expect(grid).toHaveAttribute('aria-rowcount', '6');
    expect(grid).toHaveAttribute('aria-colcount', '5');
    expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0);
  });

  it('mounts only the visible window for a large dataset when virtualized', () => {
    setup({ students: 1000, assessments: 60 });
    const mounted = screen.getAllByRole('gridcell').length;
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(500); // out of 61,000
  });

  it('mounts every cell when virtualization is off', () => {
    setup({ students: 6, assessments: 4 }, { virtualize: false });
    expect(screen.getAllByRole('gridcell')).toHaveLength(6 * 5);
  });

  it('moves the active cell with the arrow keys', async () => {
    const user = userEvent.setup();
    const { grid } = setup({ students: 5, assessments: 3 });
    grid.focus();
    expect(grid).toHaveAttribute('aria-activedescendant', 'cell-0-0');
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}');
    expect(grid).toHaveAttribute('aria-activedescendant', 'cell-2-1');
    expect(cell(2, 1)).toHaveAttribute('aria-selected', 'true');
  });

  it('types a score, commits with Enter, and moves down', async () => {
    const user = userEvent.setup();
    const { store, grid } = setup({ students: 5, assessments: 3 });
    grid.focus();
    await user.keyboard('7{Enter}');
    expect(store.getState().gradebook.scores[0][0]).toBe(7);
    expect(cell(0, 0)).toHaveTextContent('7');
    expect(grid).toHaveAttribute('aria-activedescendant', 'cell-1-0');
  });

  it('cancels an edit with Escape', async () => {
    const user = userEvent.setup();
    const { store, grid } = setup({ students: 5, assessments: 3 });
    grid.focus();
    await user.keyboard('7{Escape}');
    expect(store.getState().gradebook.scores[0][0]).toBeNull();
  });

  it('does not allow editing the read-only average column', async () => {
    const user = userEvent.setup();
    const { grid } = setup({ students: 3, assessments: 2 });
    grid.focus();
    await user.keyboard('{End}5');
    expect(grid).toHaveAttribute('aria-activedescendant', 'cell-0-2');
    expect(document.querySelector('[data-edit]')).toBeNull();
  });

  it('undoes and redoes with the keyboard', async () => {
    const user = userEvent.setup();
    const { store, grid } = setup({ students: 5, assessments: 3 });
    grid.focus();
    await user.keyboard('7{Enter}');
    await user.keyboard('{Control>}z{/Control}');
    expect(store.getState().gradebook.scores[0][0]).toBeNull();
    await user.keyboard('{Control>}y{/Control}');
    expect(store.getState().gradebook.scores[0][0]).toBe(7);
  });

  it('fills a block when spreadsheet text is pasted', () => {
    const { store, grid } = setup({ students: 5, assessments: 3 });
    grid.focus();
    fireEvent.paste(grid, { clipboardData: { getData: () => '7\t8\n9\t10' } });
    const { scores } = store.getState().gradebook;
    expect([scores[0][0], scores[0][1], scores[1][0], scores[1][1]]).toEqual([7, 8, 9, 10]);
  });

  it('describes each score for assistive technology, not just by colour', async () => {
    const user = userEvent.setup();
    const { grid } = setup({ students: 3, assessments: 3 });
    grid.focus();
    await user.keyboard('9{Enter}');
    expect(cell(0, 0)).toHaveAttribute('aria-label', expect.stringMatching(/9 of 10, Mastered/));
    expect(within(cell(0, 0)).getByText('M')).toBeInTheDocument();
  });
});

describe('App', () => {
  it('announces validation problems in a live region', async () => {
    const user = userEvent.setup();
    const store = makeStore({ students: 4, assessments: 3, fillRate: 0 });
    render(<Provider store={store}><App /></Provider>);
    screen.getByRole('grid').focus();
    await user.keyboard('99{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('99 is above the maximum of 10');
  });
});
