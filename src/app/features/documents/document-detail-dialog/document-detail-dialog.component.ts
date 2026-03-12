import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DocumentRow } from '../document-row.model';

export interface DocumentDetailDialogData {
  row: DocumentRow;
}

@Component({
  selector: 'app-document-detail-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './document-detail-dialog.component.html',
  styleUrl: './document-detail-dialog.component.scss',
})
export class DocumentDetailDialogComponent {
  protected dialogRef = inject(MatDialogRef<DocumentDetailDialogComponent>);
  protected data = inject<DocumentDetailDialogData>(MAT_DIALOG_DATA);

  protected get row(): DocumentRow {
    return this.data.row;
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
    this.dialogRef.close();
  }
}
