import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  // GitHub Pages serves the demo from /gradebook-grid-concept/; local builds stay at the root.
  base: process.env.PAGES_BASE ?? '/',
  plugins: [react()],
  resolve: {
    // React strips <Profiler> from production builds. The demo's performance panel
    // reads Profiler timings, so production builds use React's profiling build instead.
    alias: command === 'build' ? { 'react-dom/client': 'react-dom/profiling' } : {},
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
}));
