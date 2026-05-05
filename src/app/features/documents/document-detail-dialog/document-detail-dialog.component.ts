import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { VbButtonComponent } from 'vbomba-ui';
import { DocumentRow } from '../document-row.model';

export interface DocumentDetailDialogData {
  row: DocumentRow;
}

@Component({
  selector: 'app-document-detail-dialog',
  standalone: true,
  imports: [VbButtonComponent],
  templateUrl: './document-detail-dialog.component.html',
  styleUrl: './document-detail-dialog.component.scss',
})
export class DocumentDetailDialogComponent {
  protected dialogRef = inject(MatDialogRef<DocumentDetailDialogComponent>, { optional: true });
  protected dialogData = inject<DocumentDetailDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  @Input() documentRow: DocumentRow | null = null;
  @Output() closed = new EventEmitter<void>();

  protected get row(): DocumentRow {
    return (
      this.documentRow ??
      this.dialogData?.row ?? {
        id: '',
        document: null,
        metadata: null,
        embeddingPreview: null,
        embedding: null,
      }
    );
  }

  protected formatMetadata(meta: Record<string, unknown> | null): string {
    if (!meta || typeof meta !== 'object') return '—';
    return JSON.stringify(meta, null, 2);
  }

  protected get embeddingSummary(): string {
    const v = this.row.embedding;
    if (!v || !v.length) return '—';
    const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
    const preview = v.slice(0, 10).map((x) => x.toFixed(4)).join(', ');
    const more = v.length > 10 ? ` … +${v.length - 10} more` : '';
    return `‖v‖ ≈ ${norm.toFixed(4)}\n[${preview}${more}]`;
  }

  protected close(): void {
    this.closed.emit();
    this.dialogRef?.close();
  }
}
