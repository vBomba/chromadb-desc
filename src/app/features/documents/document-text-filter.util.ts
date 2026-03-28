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

export function documentRowMatchesNeedle(row: DocumentRow, needleLower: string): boolean {
  return documentRowHaystack(row).includes(needleLower);
}
