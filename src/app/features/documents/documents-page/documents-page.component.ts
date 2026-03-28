import { Component, inject, signal, computed, effect, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ChromaApiService, GetRecordsResponse } from '../../../core/services/chroma-api.service';
import { ErrorLogService } from '../../../core/services/error-log.service';
import { AddDocumentDialogComponent } from '../add-document-dialog/add-document-dialog.component';
import { EditMetadataDialogComponent } from '../edit-metadata-dialog/edit-metadata-dialog.component';
import { DeleteDocumentDialogComponent } from '../delete-document-dialog/delete-document-dialog.component';
import { DocumentDetailDialogComponent } from '../document-detail-dialog/document-detail-dialog.component';
import { EmbeddingMapDialogComponent } from '../embedding-map-dialog/embedding-map-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { DocumentRow } from '../document-row.model';
import { SelectionModel } from '@angular/cdk/collections';
import { MatCheckboxModule } from '@angular/material/checkbox';

const PAGE_SIZE = 25;
const TEXT_FILTER_BATCH = 500;
/** Stop scanning after this many records (avoids freezing huge collections). */
const TEXT_FILTER_MAX_SCAN = 100_000;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Case-insensitive highlight; `needle` must be non-empty. */
function highlightHtml(text: string, needle: string): string {
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

@Component({
  selector: 'app-documents-page',
  standalone: true,
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
  ],
  templateUrl: './documents-page.component.html',
  styleUrl: './documents-page.component.scss',
})
export class DocumentsPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private chroma = inject(ChromaApiService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private errorLog = inject(ErrorLogService);
  private sanitizer = inject(DomSanitizer);

  /** Full result set when a text filter is applied (client-side pagination). */
  private filteredRowsCache: DocumentRow[] = [];

  protected collectionId = signal<string | null>(null);
  protected collectionName = signal<string>('');
  protected dimension = signal<number | null>(null);
  protected loading = signal(true);
  protected totalEstimate = signal<number>(0);
  protected dataSource = new MatTableDataSource<DocumentRow>([]);
  protected selection = new SelectionModel<DocumentRow>(true, []);
  protected readonly displayedColumns = ['select', 'id', 'document', 'metadata', 'embedding', 'actions'];

  protected pageIndex = signal(0);
  protected pageSize = PAGE_SIZE;
  protected searchQuery = signal('');
  protected searchMode = signal<'list' | 'search'>('list');
  /** Value in the text-filter input before Apply. */
  protected textFilterDraft = signal('');
  /** Applied substring (case-insensitive); highlights and drives matching. */
  protected appliedTextFilter = signal('');

  protected paginatorLength = computed(() => {
    const t = this.totalEstimate();
    return typeof t === 'number' && t >= 0 ? t : this.pageSize;
  });

  protected totalPages = computed(() => Math.max(1, Math.ceil(this.paginatorLength() / this.pageSize)));

  /** 1-based page number shown in the jump field; kept in sync when `pageIndex` changes. */
  protected pageJumpInput = signal('1');

  constructor() {
    effect(() => {
      this.pageJumpInput.set(String(this.pageIndex() + 1));
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('collectionId');
    if (!id) return;
    this.collectionId.set(id);
    this.chroma.listCollections(500, 0).subscribe({
      next: (list) => {
        const c = list.find((x) => x.id === id);
        if (c) {
          this.collectionName.set(c.name);
          this.dimension.set(c.dimension ?? null);
        }
      },
    });
    this.loadPage(0);
  }

  protected onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    if (this.hasTextFilter()) {
      this.applyFilteredPageSlice(event.pageIndex);
    } else {
      this.loadPage(event.pageIndex);
    }
  }

  protected hasTextFilter(): boolean {
    return this.appliedTextFilter().trim().length > 0;
  }

  /** Highlight only on the list view; semantic search rows ignore the text filter. */
  protected showTextFilterHighlight(): boolean {
    return this.searchMode() === 'list' && this.hasTextFilter();
  }

  protected applyTextFilter(): void {
    const q = this.textFilterDraft().trim();
    this.appliedTextFilter.set(q);
    if (!q) {
      this.filteredRowsCache = [];
      this.pageIndex.set(0);
      this.loadPage(0);
      return;
    }
    this.pageIndex.set(0);
    this.runTextFilterScan();
  }

  protected clearTextFilter(): void {
    this.textFilterDraft.set('');
    this.appliedTextFilter.set('');
    this.filteredRowsCache = [];
    this.pageIndex.set(0);
    this.loadPage(0);
  }

  /** Safe HTML for table cells when substring filter is active. */
  protected cellHtml(text: string | null, maxLen: number): SafeHtml {
    const t = text ?? '';
    const display = maxLen > 0 && t.length > maxLen ? t.slice(0, maxLen) + '…' : t;
    const needle = this.appliedTextFilter().trim();
    const html = needle ? highlightHtml(display, needle) : escapeHtml(display);
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  protected goToJumpPage(): void {
    const raw = this.pageJumpInput().trim();
    const n = parseInt(raw, 10);
    const max = this.totalPages();
    if (!Number.isFinite(n) || n < 1) {
      this.pageJumpInput.set(String(this.pageIndex() + 1));
      return;
    }
    const pageOneBased = Math.min(Math.max(1, n), max);
    const idx = pageOneBased - 1;
    if (idx === this.pageIndex()) {
      this.pageJumpInput.set(String(pageOneBased));
      return;
    }
    this.pageIndex.set(idx);
    if (this.hasTextFilter()) {
      this.applyFilteredPageSlice(idx);
    } else {
      this.loadPage(idx);
    }
  }

  private loadPage(pageIndex: number): void {
    const cid = this.collectionId();
    if (!cid) return;
    if (this.hasTextFilter()) {
      this.applyFilteredPageSlice(pageIndex);
      return;
    }
    this.loading.set(true);
    const limit = this.pageSize;
    const offset = pageIndex * limit;
    this.chroma
      .getRecords(cid, {
        where: { $and: [] },
        include: ['documents', 'metadatas', 'embeddings'],
        limit,
        offset,
      })
      .subscribe({
        next: (res) => {
          this.applyGetResponse(res, pageIndex);
          if (this.searchMode() === 'list') {
            this.chroma.countRecords(cid).subscribe({
              next: (r: { count?: number; total?: number } | number) => {
                const count =
                  typeof r === 'number' ? r : (typeof (r as { count?: number }).count === 'number' ? (r as { count: number }).count : (r as { total?: number }).total);
                if (typeof count === 'number' && count >= 0) this.totalEstimate.set(count);
              },
              error: () => {},
            });
          }
        },
        error: (err) => {
          this.loading.set(false);
          const { message, detail, hint } = ErrorLogService.messageFromError(err);
          this.errorLog.push(`Documents: ${message}`, detail, hint);
          this.snackBar.open('Failed to load documents', 'Close', { duration: 5000 });
        },
      });
  }

  private rowHaystack(row: DocumentRow): string {
    const parts = [row.id, row.document ?? '', this.formatMetadata(row.metadata), row.embeddingPreview ?? ''];
    return parts.join('\u0001').toLowerCase();
  }

  private rowMatchesNeedle(row: DocumentRow, needleLower: string): boolean {
    return this.rowHaystack(row).includes(needleLower);
  }

  private mapResponseToRows(res: GetRecordsResponse): DocumentRow[] {
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

  private applyFilteredPageSlice(pageIndex: number): void {
    const start = pageIndex * this.pageSize;
    this.dataSource.data = this.filteredRowsCache.slice(start, start + this.pageSize);
    this.loading.set(false);
  }

  private finishTextFilterScan(matches: DocumentRow[], truncated: boolean): void {
    this.filteredRowsCache = matches;
    this.totalEstimate.set(matches.length);
    this.pageIndex.set(0);
    this.applyFilteredPageSlice(0);
    if (truncated) {
      this.snackBar.open(
        `Text filter: only the first ${TEXT_FILTER_MAX_SCAN.toLocaleString()} records were scanned. Refine the filter if needed.`,
        'Close',
        { duration: 8000 }
      );
    }
  }

  private runTextFilterScan(): void {
    const cid = this.collectionId();
    const needle = this.appliedTextFilter().trim();
    if (!cid || !needle) return;
    const needleLower = needle.toLowerCase();
    this.loading.set(true);
    const matches: DocumentRow[] = [];
    let offset = 0;

    const fetchNext = (): void => {
      const limit = Math.min(TEXT_FILTER_BATCH, TEXT_FILTER_MAX_SCAN - offset);
      if (limit <= 0) {
        this.finishTextFilterScan(matches, true);
        return;
      }
      this.chroma
        .getRecords(cid, {
          where: { $and: [] },
          include: ['documents', 'metadatas', 'embeddings'],
          limit,
          offset,
        })
        .subscribe({
          next: (res) => {
            const rows = this.mapResponseToRows(res);
            for (const row of rows) {
              if (this.rowMatchesNeedle(row, needleLower)) matches.push(row);
            }
            offset += rows.length;
            const fullBatch = rows.length === limit;
            if (fullBatch && offset < TEXT_FILTER_MAX_SCAN) {
              fetchNext();
            } else if (fullBatch && offset >= TEXT_FILTER_MAX_SCAN) {
              this.finishTextFilterScan(matches, true);
            } else {
              this.finishTextFilterScan(matches, false);
            }
          },
          error: (err) => {
            this.loading.set(false);
            const { message, detail, hint } = ErrorLogService.messageFromError(err);
            this.errorLog.push(`Text filter: ${message}`, detail, hint);
            this.snackBar.open('Failed to scan collection', 'Close', { duration: 5000 });
          },
        });
    };

    fetchNext();
  }

  private refreshListAfterMutation(): void {
    if (this.hasTextFilter()) {
      this.runTextFilterScan();
    } else {
      this.loadPage(this.pageIndex());
    }
  }

  private applyGetResponse(res: GetRecordsResponse, pageIndex: number): void {
    const rows = this.mapResponseToRows(res);
    this.dataSource.data = rows;
    const loaded = pageIndex * this.pageSize + rows.length;
    const total = Math.max(loaded, rows.length > 0 ? loaded : 0);
    this.totalEstimate.set(total >= 0 ? total : this.pageSize);
    this.loading.set(false);
  }

  protected runSearch(): void {
    const cid = this.collectionId();
    const q = this.searchQuery().trim();
    if (!cid || !q) return;
    this.searchMode.set('search');
    this.loading.set(true);
    this.chroma
      .queryCollection(
        cid,
        {
          query_texts: [q],
          n_results: 25,
          include: ['documents', 'metadatas', 'distances'],
        }
      )
      .subscribe({
        next: (res) => {
          const ids = res.ids?.[0] ?? [];
          const docs = res.documents?.[0] ?? [];
          const metas = res.metadatas?.[0] ?? [];
          const rows: DocumentRow[] = ids.map((id, i) => ({
              id,
              document: docs[i] ?? null,
              metadata: metas[i] ?? null,
              embeddingPreview: null,
            }));
          this.dataSource.data = rows;
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          const { message, detail, hint } = ErrorLogService.messageFromError(err);
          this.errorLog.push(`Search: ${message}`, detail, hint);
          this.snackBar.open('Search failed', 'Close', { duration: 5000 });
        },
      });
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
    this.searchMode.set('list');
    this.pageIndex.set(0);
    if (this.hasTextFilter()) {
      this.runTextFilterScan();
    } else {
      this.loadPage(0);
    }
  }

  protected toggleAll(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selection.select(...this.dataSource.data);
    }
  }

  protected isAllSelected(): boolean {
    return this.selection.selected.length === this.dataSource.data.length && this.dataSource.data.length > 0;
  }

  protected toggleRow(row: DocumentRow): void {
    this.selection.toggle(row);
  }

  protected bulkDelete(): void {
    const cid = this.collectionId();
    if (!cid) return;
    const ids = this.selection.selected.map((r) => r.id);
    if (!ids.length) return;
    this.loading.set(true);
    this.chroma.deleteRecords(cid, { ids }).subscribe({
      next: () => {
        this.snackBar.open(`Deleted ${ids.length} documents`, 'Close', { duration: 4000 });
        this.selection.clear();
        if (this.hasTextFilter()) {
          const idSet = new Set(ids);
          this.filteredRowsCache = this.filteredRowsCache.filter((r) => !idSet.has(r.id));
          this.totalEstimate.set(this.filteredRowsCache.length);
          let pi = this.pageIndex();
          const maxPi = Math.max(0, Math.ceil(this.filteredRowsCache.length / this.pageSize) - 1);
          if (pi > maxPi) {
            pi = maxPi;
            this.pageIndex.set(pi);
          }
          this.applyFilteredPageSlice(pi);
          this.loading.set(false);
        } else {
          this.loadPage(this.pageIndex());
        }
      },
      error: (err) => {
        this.loading.set(false);
        const { message, detail, hint } = ErrorLogService.messageFromError(err);
        this.errorLog.push(`Bulk delete: ${message}`, detail, hint);
        this.snackBar.open('Bulk delete failed', 'Close', { duration: 5000 });
      },
    });
  }

  protected openAddDialog(): void {
    const cid = this.collectionId();
    const dim = this.dimension();
    if (!cid) return;
    const ref = this.dialog.open(AddDocumentDialogComponent, {
      width: '520px',
      data: { collectionId: cid, dimension: dim },
    });
    ref.afterClosed().subscribe((added) => {
      if (added) this.refreshListAfterMutation();
    });
  }

  protected openEditMetadataDialog(row: DocumentRow): void {
    const cid = this.collectionId();
    if (!cid) return;
    const ref = this.dialog.open(EditMetadataDialogComponent, {
      width: '520px',
      data: { collectionId: cid, documentRow: row, dimension: this.dimension() },
    });
    ref.afterClosed().subscribe((updated) => {
      if (updated) this.refreshListAfterMutation();
    });
  }

  protected copyId(id: string, event?: Event): void {
    if (event) (event as Event).stopPropagation();
    navigator.clipboard.writeText(id).then(
      () => this.snackBar.open('ID copied', 'Close', { duration: 2000 }),
      () => this.snackBar.open('Copy failed', 'Close', { duration: 3000 })
    );
  }

  protected openDetailDialog(row: DocumentRow): void {
    this.dialog.open(DocumentDetailDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      data: { row },
    });
  }

  protected openDeleteDialog(row: DocumentRow): void {
    const cid = this.collectionId();
    if (!cid) return;
    const ref = this.dialog.open(DeleteDocumentDialogComponent, {
      width: '400px',
      data: { collectionId: cid, documentRow: row },
    });
    ref.afterClosed().subscribe((deleted) => {
      if (deleted) this.refreshListAfterMutation();
    });
  }

  protected formatMetadata(meta: Record<string, unknown> | null): string {
    if (!meta || typeof meta !== 'object') return '—';
    return JSON.stringify(meta);
  }

  protected truncate(text: string | null, max = 80): string {
    if (text == null) return '—';
    return text.length <= max ? text : text.slice(0, max) + '…';
  }

  protected hasEmbeddingsForMap(): boolean {
    return this.dataSource.data.some((r) => Array.isArray(r.embedding) && r.embedding && r.embedding.length);
  }

  protected openEmbeddingMap(): void {
    if (!this.hasEmbeddingsForMap()) {
      this.snackBar.open('No embeddings on current page', 'Close', { duration: 3000 });
      return;
    }
    this.dialog.open(EmbeddingMapDialogComponent, {
      width: '720px',
      maxWidth: '95vw',
      data: {
        rows: this.dataSource.data,
        title: this.collectionName() || 'Documents',
      },
    });
  }
}
