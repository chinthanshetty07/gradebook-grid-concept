/** Which items of a long list overlap the viewport (plus a small overscan so fast scrolling never shows gaps). */
export function getRange({ offset, viewport, size, total, overscan = 3 }) {
  if (total <= 0) return { start: 0, end: 0 };
  const start = Math.max(0, Math.floor(offset / size) - overscan);
  const end = Math.min(total, Math.ceil((offset + viewport) / size) + overscan);
  return { start, end: Math.max(start, end) };
}
