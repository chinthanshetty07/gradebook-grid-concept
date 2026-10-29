/** Parses text copied from a spreadsheet (tab-separated columns, newline-separated rows). */
export function parseTSV(text) {
  if (!text) return [];
  const normalised = text.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  if (normalised === '') return [];
  return normalised.split('\n').map((line) => line.split('\t'));
}
