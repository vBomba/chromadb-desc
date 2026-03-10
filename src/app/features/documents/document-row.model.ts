export interface DocumentRow {
  id: string;
  document: string | null;
  metadata: Record<string, unknown> | null;
  embeddingPreview: string | null;
}
