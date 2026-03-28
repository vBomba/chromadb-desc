import { GetRecordsResponse } from '../../core/services/chroma-api.service';
import { DocumentRow } from './document-row.model';

/** Map Chroma `get` response rows to table rows (incl. embedding preview). */
export function mapGetRecordsResponseToRows(res: GetRecordsResponse): DocumentRow[] {
  const ids = res.ids ?? [];
  const docs = res.documents ?? [];
  const metas = res.metadatas ?? [];
  const embs = res.embeddings ?? [];
  return ids.map((id, i) => {
    const v = embs[i];
    let preview: string | null = null;
    let embedding: number[] | null = null;
    if (v && Array.isArray(v)) {
      const first = Array.isArray(v[0]) ? (v[0] as number[]) : (v as unknown as number[]);
      if (first.length) {
        embedding = first;
        const norm = Math.sqrt(first.reduce((sum, x) => sum + x * x, 0));
        preview = `[${first.slice(0, 3).map((x) => x.toFixed(3)).join(', ')}…] ‖v‖≈${norm.toFixed(2)}`;
      }
    }
    return {
      id,
      document: docs[i] ?? null,
      metadata: metas[i] ?? null,
      embeddingPreview: preview,
      embedding,
    };
  });
}
