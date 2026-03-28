export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Case-insensitive highlight; `needle` must be non-empty for marks. */
export function highlightHtml(text: string, needle: string): string {
  const n = needle.trim();
  if (!n) return escapeHtml(text);
  const lowerText = text.toLowerCase();
  const lowerNeedle = n.toLowerCase();
  let out = '';
  let start = 0;
  while (true) {
    const idx = lowerText.indexOf(lowerNeedle, start);
    if (idx < 0) {
      out += escapeHtml(text.slice(start));
      break;
    }
    out += escapeHtml(text.slice(start, idx));
    out += '<mark class="text-filter-hit">' + escapeHtml(text.slice(idx, idx + n.length)) + '</mark>';
    start = idx + n.length;
  }
  return out;
}
