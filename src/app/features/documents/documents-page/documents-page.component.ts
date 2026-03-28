import { Component, inject, signal, computed, effect, OnInit } from '@angular/core';
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
  protected metadataKey = signal('');
  protected metadataValue = signal('');

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
    this.loadPage(event.pageIndex);
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
    this.loadPage(idx);
  }

  private loadPage(pageIndex: number): void {
    const cid = this.collectionId();
    if (!cid) return;
    this.loading.set(true);
    const limit = this.pageSize;
    const offset = pageIndex * limit;
    const where = this.buildWhere();
    this.chroma
      .getRecords(cid, {
        where,
        include: ['documents', 'metadatas', 'embeddings'],
        limit,
        offset,
      })
      .subscribe({
        next: (res) => {
          this.applyGetResponse(res, pageIndex);
          if (this.searchMode() === 'list' && !this.hasMetadataFilter()) {
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

  private hasMetadataFilter(): boolean {
    return this.metadataKey().trim().length > 0 && this.metadataValue().trim().length > 0;
  }

  private applyGetResponse(res: GetRecordsResponse, pageIndex: number): void {
    const ids = res.ids ?? [];
    const docs = res.documents ?? [];
    const metas = res.metadatas ?? [];
    const embs = res.embeddings ?? [];
    const rows: DocumentRow[] = ids.map((id, i) => {
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
    this.dataSource.data = rows;
    const loaded = pageIndex * this.pageSize + rows.length;
    const total =
      this.hasMetadataFilter()
        ? loaded + (rows.length >= this.pageSize ? 1 : 0)
        : Math.max(loaded, rows.length > 0 ? loaded : 0);
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
    this.loadPage(0);
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
        this.loadPage(this.pageIndex());
      },
      error: (err) => {
        this.loading.set(false);
        const { message, detail, hint } = ErrorLogService.messageFromError(err);
        this.errorLog.push(`Bulk delete: ${message}`, detail, hint);
        this.snackBar.open('Bulk delete failed', 'Close', { duration: 5000 });
      },
    });
  }

  protected applyMetadataFilter(): void {
    this.pageIndex.set(0);
    this.loadPage(0);
  }

  /** Build Chroma where clause. Empty filter must be { "$and": [] } (match all), not {}. */
  private buildWhere(): unknown {
    const key = this.metadataKey().trim();
    const value = this.metadataValue().trim();
    if (!key || !value) {
      return { $and: [] };
    }
    try {
      const parsed = JSON.parse(value);
      return { [key]: { $eq: parsed } };
    } catch {
      return { [key]: { $eq: value } };
    }
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
      if (added) this.loadPage(this.pageIndex());
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
      if (updated) this.loadPage(this.pageIndex());
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
      if (deleted) this.loadPage(this.pageIndex());
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
