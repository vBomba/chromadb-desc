import { AfterViewInit, Component, ElementRef, Inject, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DocumentRow } from '../document-row.model';
import { DocumentDetailDialogComponent } from '../document-detail-dialog/document-detail-dialog.component';

export interface EmbeddingMapDialogData {
  rows: DocumentRow[];
  title: string;
}

interface Point2D {
  x: number;
  y: number;
  row: DocumentRow;
}

@Component({
  selector: 'app-embedding-map-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './embedding-map-dialog.component.html',
  styleUrl: './embedding-map-dialog.component.scss',
})
export class EmbeddingMapDialogComponent implements AfterViewInit {
  @ViewChild('canvas', { static: false }) canvasRef?: ElementRef<HTMLCanvasElement>;

  constructor(
    private dialogRef: MatDialogRef<EmbeddingMapDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EmbeddingMapDialogData,
    private dialog: MatDialog
  ) {}

  private points: Point2D[] = [];
  private selected: Point2D | null = null;
  private neighborIds = new Set<string>();

  get hasEmbeddings(): boolean {
    return this.data.rows.some((r) => Array.isArray(r.embedding) && r.embedding.length);
  }

  ngAfterViewInit(): void {
    if (!this.hasEmbeddings) return;
    // Defer until after dialog is laid out so canvas is in DOM with correct dimensions
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.draw());
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

    // Use fixed visible colors so canvas is never black and points are always visible
    const bg = '#f5f5f5';
    const primary = '#1976d2';
    const secondary = '#ed6c02';
    const neighbor = '#5c6bc0';

    const rowsWithEmb = this.data.rows.filter((r) => Array.isArray(r.embedding) && r.embedding.length > 0);
    if (!rowsWithEmb.length) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      return;
    }

    const embeddings = rowsWithEmb.map((r) => this.normalizeEmbedding(r.embedding!));
    const projected = this.projectTo2D(embeddings);
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
      if (this.selected && p.row.id === this.selected.row.id) {
        color = secondary;
      } else if (this.neighborIds.has(p.row.id)) {
        color = neighbor;
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Ensure embedding is a flat number[] (API may return nested array). */
  private normalizeEmbedding(v: number[] | number[][]): number[] {
    if (!Array.isArray(v) || !v.length) return [];
    const first = v[0];
    if (typeof first === 'number') return v as number[];
    if (Array.isArray(first)) return first as number[];
    return [];
  }

  // Simple deterministic random projection from high-D to 2D
  private projectTo2D(vectors: number[][]): [number, number][] {
    if (!vectors.length) return [];
    const dim = vectors[0].length;
    const axis1: number[] = [];
    const axis2: number[] = [];
    for (let i = 0; i < dim; i++) {
      const t1 = Math.sin(i * 12.9898 + 78.233);
      const t2 = Math.sin(i * 93.9898 + 41.233);
      axis1.push(t1);
      axis2.push(t2);
    }
    const norm = (v: number[]) =>
      Math.sqrt(v.reduce((sum, x) => sum + x * x, 0)) || 1;
    const n1 = norm(axis1);
    const n2 = norm(axis2);
    const a1 = axis1.map((x) => x / n1);
    const a2 = axis2.map((x) => x / n2);

    const dot = (u: number[], v: number[]) => u.reduce((sum, x, i) => sum + x * v[i], 0);

    return vectors.map((v) => [dot(v, a1), dot(v, a2)]);
  }

  close(): void {
    this.dialogRef.close();
  }

  onCanvasClick(event: MouseEvent): void {
    if (!this.canvasRef || !this.points.length) return;
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    let closest: Point2D | null = null;
    let minDist = Infinity;
    for (const p of this.points) {
      const dx = p.x - x;
      const dy = p.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < minDist) {
        minDist = d2;
        closest = p;
      }
    }
    const radius2 = 15 * 15;
    if (!closest || minDist > radius2) return;

    this.selected = closest;
    this.updateNeighbors();
    this.draw();

    this.dialog.open(DocumentDetailDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      data: { row: closest.row },
    });
  }

  private updateNeighbors(): void {
    this.neighborIds.clear();
    if (!this.selected || !this.selected.row.embedding) return;
    const target = this.normalizeEmbedding(this.selected.row.embedding);
    if (!target.length) return;
    const rows = this.data.rows.filter((r) => Array.isArray(r.embedding) && r.embedding && r.embedding.length);
    const distances = rows
      .filter((r) => r.id !== this.selected!.row.id)
      .map((r) => ({
        id: r.id,
        d2: this.squaredDistance(target, this.normalizeEmbedding(r.embedding!)),
      }))
      .sort((a, b) => a.d2 - b.d2)
      .slice(0, 8);
    for (const item of distances) {
      this.neighborIds.add(item.id);
    }
  }

  private squaredDistance(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    let sum = 0;
    for (let i = 0; i < len; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return sum;
  }
}

