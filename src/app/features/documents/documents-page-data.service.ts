import { Injectable, inject } from '@angular/core';
import { Observable, Subscriber, Subscription, catchError, forkJoin, map, of } from 'rxjs';
import { ChromaApiService, GetRecordsResponse } from '../../core/services/chroma-api.service';
import { DocumentRow } from './document-row.model';
import { mapGetRecordsResponseToRows } from './document-row.mapper';
import {
  TEXT_FILTER_BATCH,
  TEXT_FILTER_MAX_SCAN,
  documentRowMatchesNeedle,
} from './document-text-filter.util';

export interface DocumentsListPageResult {
  rows: DocumentRow[];
  pageIndex: number;
  /** Heuristic total until / unless count API updates it */
  interimTotal: number;
  /** From count API when requested */
  countedTotal?: number;
}

export interface TextFilterScanResult {
  matches: DocumentRow[];
  truncated: boolean;
}

function extractRecordCount(r: { count?: number; total?: number } | number | null): number | undefined {
  if (r == null) return undefined;
  if (typeof r === 'number') return r >= 0 ? r : undefined;
  if (typeof r.count === 'number') return r.count >= 0 ? r.count : undefined;
  if (typeof r.total === 'number') return r.total >= 0 ? r.total : undefined;
  return undefined;
}

/**
 * Chroma list / scan / query orchestration for the documents page.
 * Callers should pipe `takeUntilDestroyed()` (from `@angular/core/rxjs-interop`) or otherwise unsubscribe. Sequential scan cancels in-flight HTTP on unsubscribe.
 */
@Injectable()
export class DocumentsPageDataService {
  private chroma = inject(ChromaApiService);

  loadCollectionMeta(collectionId: string): Observable<{ name: string; dimension: number | null } | null> {
    return this.chroma.listCollections(500, 0).pipe(
      map((list) => {
        const c = list.find((x) => x.id === collectionId);
        if (!c) return null;
        return { name: c.name, dimension: c.dimension ?? null };
      })
    );
  }

  loadDocumentsListPage(params: {
    collectionId: string;
    pageIndex: number;
    pageSize: number;
    fetchTotalCount: boolean;
  }): Observable<DocumentsListPageResult> {
    const { collectionId, pageIndex, pageSize, fetchTotalCount } = params;
    const limit = pageSize;
    const offset = pageIndex * limit;

    const page$ = this.chroma.getRecords(collectionId, {
      where: { $and: [] },
      include: ['documents', 'metadatas', 'embeddings'],
      limit,
      offset,
    });

    if (!fetchTotalCount) {
      return page$.pipe(map((res) => this.toListPageResult(res, pageIndex, pageSize)));
    }

    return forkJoin({
      page: page$,
      count: this.chroma.countRecords(collectionId).pipe(catchError(() => of(null))),
    }).pipe(
      map(({ page, count }) => {
        const base = this.toListPageResult(page, pageIndex, pageSize);
        const countedTotal = extractRecordCount(count);
        return countedTotal !== undefined ? { ...base, countedTotal } : base;
      })
    );
  }

  private toListPageResult(res: GetRecordsResponse, pageIndex: number, pageSize: number): DocumentsListPageResult {
    const rows = mapGetRecordsResponseToRows(res);
    const loaded = pageIndex * pageSize + rows.length;
    const interimTotal = Math.max(loaded, rows.length > 0 ? loaded : 0);
    return {
      rows,
      pageIndex,
      interimTotal: interimTotal >= 0 ? interimTotal : pageSize,
    };
  }

  /**
   * Sequential getRecords until filter cap or short batch; cancels in-flight HTTP when unsubscribed.
   */
  scanForTextFilter(collectionId: string, needleLower: string): Observable<TextFilterScanResult> {
    return new Observable<TextFilterScanResult>((subscriber: Subscriber<TextFilterScanResult>) => {
      const matches: DocumentRow[] = [];
      let offset = 0;
      let cancelled = false;
      let innerSub: Subscription | undefined;

      const finish = (truncated: boolean) => {
        if (cancelled || subscriber.closed) return;
        subscriber.next({ matches: [...matches], truncated });
        subscriber.complete();
      };

      const fail = (err: unknown) => {
        if (cancelled || subscriber.closed) return;
        subscriber.error(err);
      };

      const step = () => {
        if (cancelled || subscriber.closed) return;
        const limit = Math.min(TEXT_FILTER_BATCH, TEXT_FILTER_MAX_SCAN - offset);
        if (limit <= 0) {
          finish(true);
          return;
        }
        innerSub = this.chroma
          .getRecords(collectionId, {
            where: { $and: [] },
            include: ['documents', 'metadatas', 'embeddings'],
            limit,
            offset,
          })
          .subscribe({
            next: (res) => {
              if (cancelled) return;
              const rows = mapGetRecordsResponseToRows(res);
              for (const row of rows) {
                if (documentRowMatchesNeedle(row, needleLower)) matches.push(row);
              }
              offset += rows.length;
              const fullBatch = rows.length === limit;
              if (fullBatch && offset < TEXT_FILTER_MAX_SCAN) {
                step();
              } else if (fullBatch && offset >= TEXT_FILTER_MAX_SCAN) {
                finish(true);
              } else {
                finish(false);
              }
            },
            error: (err) => fail(err),
          });
      };

      step();

      return () => {
        cancelled = true;
        innerSub?.unsubscribe();
      };
    });
  }

  querySemanticSearch(collectionId: string, queryText: string, nResults = 25): Observable<DocumentRow[]> {
    return this.chroma
      .queryCollection(collectionId, {
        query_texts: [queryText],
        n_results: nResults,
        include: ['documents', 'metadatas', 'distances'],
      })
      .pipe(
        map((res) => {
          const ids = res.ids?.[0] ?? [];
          const docs = res.documents?.[0] ?? [];
          const metas = res.metadatas?.[0] ?? [];
          return ids.map(
            (id, i): DocumentRow => ({
              id,
              document: docs[i] ?? null,
              metadata: metas[i] ?? null,
              embeddingPreview: null,
            })
          );
        })
      );
  }
}
