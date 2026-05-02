import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Inject,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { VbButtonComponent, VbLoaderComponent, VbSelectComponent, type VbSelectOption } from 'vbomba-ui';
import { DocumentRow } from '../document-row.model';
import { DocumentDetailDialogComponent } from '../document-detail-dialog/document-detail-dialog.component';
import { pca2DScores } from '../embedding-pca.util';
import { cosineDistance } from '../embedding-similarity.util';
import { mapGetRecordsResponseToRows } from '../document-row.mapper';
import { ChromaApiService } from '../../../core/services/chroma-api.service';
import { ErrorLogService } from '../../../core/services/error-log.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

export type EmbeddingMapSourceMode = 'page' | 'sample100';

export interface EmbeddingMapDialogData {
  rows: DocumentRow[];
  title: string;
  collectionId: string;
}

interface Point2D {
  x: number;
  y: number;
  row: DocumentRow;
}

@Component({
  selector: 'app-embedding-map-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    VbButtonComponent,
    VbLoaderComponent,
    VbSelectComponent,
    MatSnackBarModule,
  ],
  templateUrl: './embedding-map-dialog.component.html',
  styleUrl: './embedding-map-dialog.component.scss',
})
export class EmbeddingMapDialogComponent implements OnInit, AfterViewInit {
  @ViewChild('canvas', { static: false }) canvasRef?: ElementRef<HTMLCanvasElement>;

  private chroma = inject(ChromaApiService);
  private snackBar = inject(MatSnackBar);
  private errorLog = inject(ErrorLogService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  /** Rows currently plotted (page or fetched sample). */
  protected viewRows: DocumentRow[] = [];

  protected sourceMode = signal<EmbeddingMapSourceMode>('page');
  protected readonly sourceOptions: VbSelectOption[] = [
    { value: 'page', label: 'Current table page' },
    { value: 'sample100', label: 'First 100 records (with embeddings)' },
  ];
  protected loadingSample = signal(false);
  protected neighborsLoading = signal(false);
  protected hoverTip = signal<{ left: number; top: number; text: string } | null>(null);
  protected hoveredNeighborId = signal<string | null>(null);

  /** Neighbor IDs from Chroma `query` (collection-wide). */
  protected collectionNeighborIds = new Set<string>();
  /** Same query, with distances when API returns them. */
  protected collectionNeighbors: { id: string; distance: number | null }[] = [];
  /** Fallback: cosine neighbors among `viewRows` only. */
  protected localNeighborIds = new Set<string>();

  private points: Point2D[] = [];
  private selected: Point2D | null = null;

  /** Avoid overlapping HTTP when switching sample / clicking neighbors quickly. */
  private sampleFetchSub: Subscription | undefined;
  private neighborQuerySub: Subscription | undefined;

  constructor(
    private dialogRef: MatDialogRef<EmbeddingMapDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EmbeddingMapDialogData,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.viewRows = [...this.data.rows];
  }

  get hasEmbeddings(): boolean {
    return this.viewRows.some((r) => Array.isArray(r.embedding) && r.embedding.length);
  }

  ngAfterViewInit(): void {
    if (!this.hasEmbeddings) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.draw());
    });
  }

  protected onSourceModeChange(mode: string): void {
    if (mode !== 'page' && mode !== 'sample100') return;
    const typed = mode as EmbeddingMapSourceMode;
    this.sourceMode.set(typed);
    this.selected = null;
    this.collectionNeighborIds.clear();
    this.collectionNeighbors = [];
    this.localNeighborIds.clear();
    this.hoverTip.set(null);
    this.hoveredNeighborId.set(null);
    if (typed === 'page') {
      this.sampleFetchSub?.unsubscribe();
      this.sampleFetchSub = undefined;
      this.viewRows = [...this.data.rows];
      this.loadingSample.set(false);
      this.cdr.markForCheck();
      requestAnimationFrame(() => this.draw());
      return;
    }
    this.loadingSample.set(true);
    this.cdr.markForCheck();
    this.sampleFetchSub?.unsubscribe();
    this.sampleFetchSub = this.chroma
      .getRecords(this.data.collectionId, {
        where: { $and: [] },
        include: ['documents', 'metadatas', 'embeddings'],
        limit: 100,
        offset: 0,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const rows = mapGetRecordsResponseToRows(res).filter(
            (r) => Array.isArray(r.embedding) && r.embedding.length > 0
          );
          this.viewRows = rows.length ? rows : [...this.data.rows];
          this.loadingSample.set(false);
          this.sampleFetchSub = undefined;
          if (!rows.length) {
            this.snackBar.open('No embeddings in the first 100 records', 'Close', { duration: 4000 });
          }
          this.cdr.markForCheck();
          requestAnimationFrame(() => this.draw());
        },
        error: (err) => {
          this.loadingSample.set(false);
          this.sampleFetchSub = undefined;
          const { message, detail, hint } = ErrorLogService.messageFromError(err);
          this.errorLog.push(`Embedding map sample: ${message}`, detail, hint);
          this.snackBar.open('Failed to load sample', 'Close', { duration: 5000 });
          this.cdr.markForCheck();
        },
      });
  }

  private draw(): void {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    if (w < 10 || h < 10) return;

    const isDark =
      typeof document !== 'undefined' && document.body.classList.contains('app-dark-theme');
    const bg = isDark ? '#1f2230' : '#f5f5f5';
    const primary = isDark ? '#c4b5fd' : '#1976d2';
    const selectedColor = '#ed6c02';
    const neighborColor = isDark ? '#8b5cf6' : '#2e7d32';

    const rowsWithEmb = this.viewRows.filter((r) => Array.isArray(r.embedding) && r.embedding.length > 0);
    if (!rowsWithEmb.length) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      return;
    }

    const embeddings = rowsWithEmb.map((r) => this.normalizeEmbedding(r.embedding!));
    const projected = pca2DScores(embeddings);
    if (!projected.length) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      return;
    }

    const xs = projected.map((p) => p[0]).filter((n) => Number.isFinite(n));
    const ys = projected.map((p) => p[1]).filter((n) => Number.isFinite(n));
    if (!xs.length || !ys.length) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      return;
    }

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const padding = 24;
    const plotW = w - 2 * padding;
    const plotH = h - 2 * padding;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    this.points = projected.map(([px, py], i) => {
      const nx = maxX === minX ? 0.5 : (Number.isFinite(px) ? (px - minX) / (maxX - minX) : 0.5);
      const ny = maxY === minY ? 0.5 : (Number.isFinite(py) ? (py - minY) / (maxY - minY) : 0.5);
      const x = padding + nx * plotW;
      const y = padding + (1 - ny) * plotH;
      return { x, y, row: rowsWithEmb[i] };
    });

    for (const p of this.points) {
      let color = primary;
      let radius = 5;
      if (this.selected && p.row.id === this.selected.row.id) {
        color = selectedColor;
      } else if (this.collectionNeighborIds.has(p.row.id) || this.localNeighborIds.has(p.row.id)) {
        color = neighborColor;
      }
      if (this.hoveredNeighborId() === p.row.id) {
        radius = 7;
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      if (this.hoveredNeighborId() === p.row.id) {
        ctx.strokeStyle = isDark ? '#e4e4e7' : '#111';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  private normalizeEmbedding(v: number[] | number[][]): number[] {
    if (!Array.isArray(v) || !v.length) return [];
    const first = v[0];
    if (typeof first === 'number') return v as number[];
    if (Array.isArray(first)) return first as number[];
    return [];
  }

  close(): void {
    this.dialogRef.close();
  }

  onCanvasClick(event: MouseEvent): void {
    if (!this.canvasRef || !this.points.length) return;
    const closest = this.hitTest(event);
    if (!closest) return;

    this.selected = closest;
    this.collectionNeighborIds.clear();
    this.collectionNeighbors = [];
    this.localNeighborIds.clear();
    this.hoveredNeighborId.set(null);
    this.updateLocalCosineNeighbors(closest);
    this.draw();
    this.cdr.markForCheck();

    this.dialog.open(DocumentDetailDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      data: { row: closest.row },
    });

    this.fetchCollectionNeighbors(closest.row);
  }

  onCanvasMove(event: MouseEvent): void {
    if (!this.canvasRef || !this.points.length) {
      this.hoverTip.set(null);
      return;
    }
    const wrap = this.canvasRef.nativeElement.parentElement;
    if (!wrap) return;

    const hit = this.hitTest(event, 14);
    if (!hit) {
      this.hoverTip.set(null);
      return;
    }
    const rect = wrap.getBoundingClientRect();
    const doc = hit.row.document?.slice(0, 120) ?? '';
    const text = doc ? `${hit.row.id}\n${doc}${hit.row.document && hit.row.document.length > 120 ? '…' : ''}` : hit.row.id;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.hoverTip.set({ left: Math.min(x + 12, rect.width - 200), top: y - 8, text });
  }

  onCanvasLeave(): void {
    this.hoverTip.set(null);
  }

  onNeighborRowEnter(id: string): void {
    this.hoveredNeighborId.set(id);
    this.draw();
  }

  onNeighborRowLeave(): void {
    this.hoveredNeighborId.set(null);
    this.draw();
  }

  private hitTest(event: MouseEvent, radius = 15): Point2D | null {
    if (!this.canvasRef) return null;
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    let closest: Point2D | null = null;
    let minDist = Infinity;
    const radius2 = radius * radius;
    for (const p of this.points) {
      const dx = p.x - x;
      const dy = p.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < minDist) {
        minDist = d2;
        closest = p;
      }
    }
    if (!closest || minDist > radius2) return null;
    return closest;
  }

  private updateLocalCosineNeighbors(closest: Point2D): void {
    const target = this.normalizeEmbedding(closest.row.embedding!);
    if (!target.length) return;
    const rows = this.viewRows.filter((r) => Array.isArray(r.embedding) && r.embedding.length);
    const ranked = rows
      .filter((r) => r.id !== closest.row.id)
      .map((r) => ({
        id: r.id,
        d: cosineDistance(target, this.normalizeEmbedding(r.embedding!)),
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 8);
    this.localNeighborIds = new Set(ranked.map((x) => x.id));
  }

  private fetchCollectionNeighbors(row: DocumentRow): void {
    const emb = this.normalizeEmbedding(row.embedding!);
    if (!emb.length || !this.data.collectionId) return;

    this.neighborsLoading.set(true);
    this.cdr.markForCheck();

    this.neighborQuerySub?.unsubscribe();
    this.neighborQuerySub = this.chroma
      .queryCollection(this.data.collectionId, {
        query_embeddings: [emb],
        n_results: 32,
        include: ['documents', 'metadatas', 'distances'],
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.neighborsLoading.set(false);
          this.neighborQuerySub = undefined;
          const ids = res.ids?.[0] ?? [];
          const dists = res.distances?.[0] ?? [];
          const pairs = ids
            .map((id, i) => ({ id, distance: dists[i] ?? null }))
            .filter((p) => p.id !== row.id)
            .slice(0, 32);
          this.collectionNeighbors = pairs;
          this.collectionNeighborIds = new Set(pairs.map((p) => p.id));
          this.localNeighborIds.clear();
          this.draw();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.neighborsLoading.set(false);
          this.neighborQuerySub = undefined;
          const { message, detail, hint } = ErrorLogService.messageFromError(err);
          this.errorLog.push(`Embedding neighbors query: ${message}`, detail, hint);
          this.snackBar.open('Could not load collection neighbors (using page only)', 'Close', {
            duration: 5000,
          });
          this.cdr.markForCheck();
        },
      });
  }

}
