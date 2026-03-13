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
    if (!this.hasEmbeddings || !this.canvasRef) return;
    this.draw();
  }

  private draw(): void {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const styles = getComputedStyle(document.body);
    const surface = styles.getPropertyValue('--mat-sys-surface') || '#ffffff';
    const primary = styles.getPropertyValue('--mat-sys-primary') || '#1976d2';
    const secondary = styles.getPropertyValue('--mat-sys-secondary') || '#ff9800';
    const neighbor = styles.getPropertyValue('--mat-sys-on-surface-variant') || '#666666';

    const rowsWithEmb = this.data.rows.filter((r) => Array.isArray(r.embedding) && r.embedding && r.embedding.length);
    if (!rowsWithEmb.length) return;

    const embeddings = rowsWithEmb.map((r) => r.embedding!) as number[][];
    const projected = this.projectTo2D(embeddings);

    const xs = projected.map((p) => p[0]);
    const ys = projected.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const padding = 24;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = surface;
    ctx.fillRect(0, 0, w, h);

    this.points = projected.map(([px, py], i) => {
      const nx = maxX === minX ? 0.5 : (px - minX) / (maxX - minX);
      const ny = maxY === minY ? 0.5 : (py - minY) / (maxY - minY);
      const x = padding + nx * (w - 2 * padding);
      const y = padding + (1 - ny) * (h - 2 * padding);
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
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
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
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
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
    const radius2 = 10 * 10;
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
    const target = this.selected.row.embedding;
    const rows = this.data.rows.filter((r) => Array.isArray(r.embedding) && r.embedding && r.embedding.length);
    const distances = rows
      .filter((r) => r.id !== this.selected!.row.id)
      .map((r) => ({
        id: r.id,
        d2: this.squaredDistance(target, r.embedding as number[]),
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

