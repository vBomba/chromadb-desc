import { DocumentRow } from './document-row.model';

export const TEXT_FILTER_BATCH = 500;

/** Stop scanning after this many records (avoids freezing huge collections). */
export const TEXT_FILTER_MAX_SCAN = 100_000;

/** Same string shape as UI metadata column for consistent matching. */
export function metadataStringForMatch(meta: Record<string, unknown> | null): string {
  if (!meta || typeof meta !== 'object') return '—';
  return JSON.stringify(meta);
}

export function documentRowHaystack(row: DocumentRow): string {
  const parts = [row.id, row.document ?? '', metadataStringForMatch(row.metadata), row.embeddingPreview ?? ''];
  return parts.join('\u0001').toLowerCase();
}

/** Which fields the text filter matches against. */
export type TextFilterScope = 'all' | 'id';

export function documentRowMatchesNeedle(
  row: DocumentRow,
  needleLower: string,
  scope: TextFilterScope = 'all'
): boolean {
  if (scope === 'id') {
    return row.id.toLowerCase().includes(needleLower);
  }
  return documentRowHaystack(row).includes(needleLower);
}
