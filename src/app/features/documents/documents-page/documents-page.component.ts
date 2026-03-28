import { Component, inject, signal, computed, effect, OnInit, DestroyRef } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
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
import { ChromaApiService } from '../../../core/services/chroma-api.service';
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
import { DocumentsPageDataService } from '../documents-page-data.service';
import { TEXT_FILTER_MAX_SCAN, metadataStringForMatch } from '../document-text-filter.util';
import { escapeHtml, highlightHtml } from '../document-highlight.util';

const PAGE_SIZE = 25;

@Component({
  selector: 'app-documents-page',
  standalone: true,
  providers: [DocumentsPageDataService],
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
  private docsData = inject(DocumentsPageDataService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private errorLog = inject(ErrorLogService);
  private sanitizer = inject(DomSanitizer);
  private destroyRef = inject(DestroyRef);

  /** Cancel overlapping list loads when the user changes page quickly. */
  private listLoadSub: Subscription | undefined;
  /** Cancel an in-progress text-filter scan when starting another or leaving. */
  private textScanSub: Subscription | undefined;
  /** Cancel overlapping semantic search. */
  private searchSub: Subscription | undefined;

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
  protected textFilterDraft = signal('');
  protected appliedTextFilter = signal('');

  protected paginatorLength = computed(() => {
    const t = this.totalEstimate();
    return typeof t === 'number' && t >= 0 ? t : this.pageSize;
  });

  protected totalPages = computed(() => Math.max(1, Math.ceil(this.paginatorLength() / this.pageSize)));

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
    this.docsData
      .loadCollectionMeta(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (meta) => {
          if (meta) {
            this.collectionName.set(meta.name);
            this.dimension.set(meta.dimension);
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
    this.listLoadSub?.unsubscribe();
    this.listLoadSub = this.docsData
      .loadDocumentsListPage({
        collectionId: cid,
        pageIndex,
        pageSize: this.pageSize,
        fetchTotalCount: this.searchMode() === 'list',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.dataSource.data = result.rows;
          this.totalEstimate.set(
            result.countedTotal !== undefined ? result.countedTotal : result.interimTotal
          );
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          const { message, detail, hint } = ErrorLogService.messageFromError(err);
          this.errorLog.push(`Documents: ${message}`, detail, hint);
          this.snackBar.open('Failed to load documents', 'Close', { duration: 5000 });
        },
      });
  }

  private applyFilteredPageSlice(pageIndex: number): void {
    const start = pageIndex * this.pageSize;
    this.dataSource.data = this.filteredRowsCache.slice(start, start + this.pageSize);
    this.loading.set(false);
  }

  private runTextFilterScan(): void {
    const cid = this.collectionId();
    const needle = this.appliedTextFilter().trim();
    if (!cid || !needle) return;
    const needleLower = needle.toLowerCase();
    this.loading.set(true);
    this.textScanSub?.unsubscribe();
    this.textScanSub = this.docsData
      .scanForTextFilter(cid, needleLower)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ matches, truncated }) => {
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
        },
        error: (err) => {
          this.loading.set(false);
          const { message, detail, hint } = ErrorLogService.messageFromError(err);
          this.errorLog.push(`Text filter: ${message}`, detail, hint);
          this.snackBar.open('Failed to scan collection', 'Close', { duration: 5000 });
        },
      });
  }

  private refreshListAfterMutation(): void {
    if (this.hasTextFilter()) {
      this.runTextFilterScan();
    } else {
      this.loadPage(this.pageIndex());
    }
  }

  protected runSearch(): void {
    const cid = this.collectionId();
    const q = this.searchQuery().trim();
    if (!cid || !q) return;
    this.searchMode.set('search');
    this.loading.set(true);
    this.searchSub?.unsubscribe();
    this.searchSub = this.docsData
      .querySemanticSearch(cid, q)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
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
    this.chroma
      .deleteRecords(cid, { ids })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((added) => {
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
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((updated) => {
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
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((deleted) => {
        if (deleted) this.refreshListAfterMutation();
      });
  }

  protected formatMetadata(meta: Record<string, unknown> | null): string {
    return metadataStringForMatch(meta);
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
    const cid = this.collectionId();
    if (!cid) return;
    this.dialog.open(EmbeddingMapDialogComponent, {
      width: '720px',
      maxWidth: '95vw',
      data: {
        rows: this.dataSource.data,
        title: this.collectionName() || 'Documents',
        collectionId: cid,
      },
    });
  }
}
