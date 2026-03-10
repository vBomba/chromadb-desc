import { Component, inject, signal, computed, OnInit } from '@angular/core';
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
import { AddDocumentDialogComponent } from '../add-document-dialog/add-document-dialog.component';
import { EditMetadataDialogComponent } from '../edit-metadata-dialog/edit-metadata-dialog.component';
import { DeleteDocumentDialogComponent } from '../delete-document-dialog/delete-document-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { DocumentRow } from '../document-row.model';

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
  ],
  templateUrl: './documents-page.component.html',
  styleUrl: './documents-page.component.scss',
})
export class DocumentsPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private chroma = inject(ChromaApiService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  protected collectionId = signal<string | null>(null);
  protected collectionName = signal<string>('');
  protected dimension = signal<number | null>(null);
  protected loading = signal(true);
  protected totalEstimate = signal<number>(0);
  protected dataSource = new MatTableDataSource<DocumentRow>([]);
  protected readonly displayedColumns = ['id', 'document', 'metadata', 'actions'];

  protected pageIndex = signal(0);
  protected pageSize = PAGE_SIZE;
  protected searchQuery = signal('');
  protected searchMode = signal<'list' | 'search'>('list');

  protected paginatorLength = computed(() => {
    const total = this.totalEstimate();
    return total > 0 ? total : this.pageSize + 1;
  });

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

  private loadPage(pageIndex: number): void {
    const cid = this.collectionId();
    if (!cid) return;
    this.loading.set(true);
    const limit = this.pageSize;
    const offset = pageIndex * limit;
    this.chroma
      .getRecords(cid, {
        where: {},
        include: ['documents', 'metadatas', 'embeddings'],
        limit,
        offset,
      })
      .subscribe({
        next: (res) => this.applyGetResponse(res, pageIndex),
        error: () => {
          this.loading.set(false);
          this.snackBar.open('Failed to load documents', 'Close', { duration: 5000 });
        },
      });
  }

  private applyGetResponse(res: GetRecordsResponse, pageIndex: number): void {
    const ids = res.ids ?? [];
    const docs = res.documents ?? [];
    const metas = res.metadatas ?? [];
    const embs = res.embeddings ?? [];
    const rows: DocumentRow[] = ids.map((id, i) => ({
      id,
      document: docs[i] ?? null,
      metadata: metas[i] ?? null,
      embeddingPreview: (() => {
        const v = embs[i];
        if (!v || !Array.isArray(v)) return null;
        const first = Array.isArray(v[0]) ? (v[0] as number[]) : (v as unknown as number[]);
        return first.length ? `[${first.slice(0, 3).join(', ')}…]` : null;
      })(),
    }));
    this.dataSource.data = rows;
    this.totalEstimate.set(pageIndex * this.pageSize + rows.length + (rows.length < this.pageSize ? 0 : 1));
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
        error: () => {
          this.loading.set(false);
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
}
