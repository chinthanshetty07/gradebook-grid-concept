const NUMBER = /^\d+(\.\d{1,2})?$/;

/** Turns what a teacher typed into a score, or an explanation of why it is not valid. Empty clears the cell. */
export function parseScore(raw, max) {
  const text = String(raw ?? '').trim();
  if (text === '') return { ok: true, value: null };
  if (!NUMBER.test(text)) return { ok: false, error: `"${text}" is not a valid score` };
  const value = Number(text);
  if (value > max) return { ok: false, error: `${value} is above the maximum of ${max}` };
  return { ok: true, value };
}

// Illustrative bands for the demo; a real school would configure its own scale.
export const BANDS = [
  { key: 'beginning', short: 'B', label: 'Beginning', min: 0 },
  { key: 'developing', short: 'D', label: 'Developing', min: 0.4 },
  { key: 'proficient', short: 'P', label: 'Proficient', min: 0.6 },
  { key: 'mastered', short: 'M', label: 'Mastered', min: 0.8 },
];

export function masteryBand(score, max) {
  if (score === null || score === undefined) return null;
  const share = score / max;
  let band = BANDS[0];
  for (const b of BANDS) if (share >= b.min) band = b;
  return band;
}
