export interface DocumentRow {
  id: string;
  document: string | null;
  metadata: Record<string, unknown> | null;
  embeddingPreview: string | null;
  /** Full first embedding vector when available (for detail view). */
  embedding?: number[] | null;
}
