import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ChromaApiService } from '../../../core/services/chroma-api.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DocumentRow } from '../document-row.model';

const DEFAULT_DIMENSION = 384;

export interface EditMetadataDialogData {
  collectionId: string;
  documentRow: DocumentRow;
  dimension: number | null;
}

@Component({
  selector: 'app-edit-metadata-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    ReactiveFormsModule,
  ],
  templateUrl: './edit-metadata-dialog.component.html',
  styleUrl: './edit-metadata-dialog.component.scss',
})
export class EditMetadataDialogComponent {
  private dialogRef = inject(MatDialogRef<EditMetadataDialogComponent>);
  private chroma = inject(ChromaApiService);
  private snackBar = inject(MatSnackBar);
  protected data = inject<EditMetadataDialogData>(MAT_DIALOG_DATA);

  protected metadataControl = new FormControl<string>(
    this.formatMeta(this.data.documentRow.metadata),
    { nonNullable: true }
  );
  protected submitting = false;

  protected get row(): DocumentRow {
    return this.data.documentRow;
  }

  private formatMeta(meta: Record<string, unknown> | null): string {
    if (!meta || typeof meta !== 'object') return '{}';
    return JSON.stringify(meta, null, 2);
  }

  protected cancel(): void {
    this.dialogRef.close(false);
  }

  protected submit(): void {
    if (this.submitting) return;
    let meta: Record<string, unknown> | null = null;
    try {
      const raw = this.metadataControl.value.trim();
      meta = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      this.snackBar.open('Invalid JSON in metadata', 'Close', { duration: 3000 });
      return;
    }
    const dim = this.data.dimension ?? DEFAULT_DIMENSION;
    const doc = this.row.document ?? '';
    const embedding = Array(dim).fill(0);
    this.submitting = true;
    this.chroma
      .upsertRecords(this.data.collectionId, {
        ids: [this.row.id],
        documents: [doc],
        metadatas: [meta],
        embeddings: [embedding],
      })
      .subscribe({
        next: () => {
          this.snackBar.open('Metadata updated', 'Close', { duration: 3000 });
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.submitting = false;
          const msg = err?.error?.message ?? err?.message ?? 'Failed to update metadata';
          this.snackBar.open(String(msg), 'Close', { duration: 5000 });
        },
      });
  }
}
