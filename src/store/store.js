import { configureStore } from '@reduxjs/toolkit';
import gradebook, { init } from './gradebookSlice.js';

export function makeStore(options = { students: 200, assessments: 30 }) {
  return configureStore({
    reducer: { gradebook },
    preloadedState: { gradebook: init(options) },
    // The dev-only immutability/serializability checks walk the entire state on every
    // action, which swamps the thing this demo measures. Immer already guarantees
    // immutability, so they are turned off here.
    middleware: (getDefault) => getDefault({ immutableCheck: false, serializableCheck: false }),
  });
}
