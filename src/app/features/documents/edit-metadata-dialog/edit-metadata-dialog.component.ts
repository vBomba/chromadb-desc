import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { VbButtonComponent, VbTextareaComponent } from 'vbomba-ui';
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
  imports: [ReactiveFormsModule, VbTextareaComponent, VbButtonComponent],
  templateUrl: './edit-metadata-dialog.component.html',
  styleUrl: './edit-metadata-dialog.component.scss',
})
export class EditMetadataDialogComponent {
  private dialogRef = inject(MatDialogRef<EditMetadataDialogComponent>, { optional: true });
  private chroma = inject(ChromaApiService);
  private snackBar = inject(MatSnackBar);
  private dialogData = inject<EditMetadataDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  @Input() collectionId: string | null = null;
  @Input() documentRow: DocumentRow | null = null;
  @Input() collectionDimension: number | null = null;
  @Output() updated = new EventEmitter<boolean>();
  @Output() cancelled = new EventEmitter<void>();

  protected metadataControl = new FormControl<string>(
    this.formatMeta((this.documentRow ?? this.dialogData?.documentRow ?? null)?.metadata ?? null),
    { nonNullable: true }
  );
  protected submitting = false;

  protected get row(): DocumentRow {
    return (
      this.documentRow ??
      this.dialogData?.documentRow ?? {
        id: '',
        document: null,
        metadata: null,
        embeddingPreview: null,
        embedding: null,
      }
    );
  }

  private formatMeta(meta: Record<string, unknown> | null): string {
    if (!meta || typeof meta !== 'object') return '{}';
    return JSON.stringify(meta, null, 2);
  }

  protected cancel(): void {
    this.cancelled.emit();
    this.dialogRef?.close(false);
  }

  protected resetToOriginal(): void {
    this.metadataControl.setValue(this.formatMeta(this.row.metadata));
  }

  protected submit(): void {
    if (this.submitting) return;
    const collectionId = this.collectionId ?? this.dialogData?.collectionId ?? null;
    if (!collectionId) return;
    let meta: Record<string, unknown> | null = null;
    try {
      const raw = this.metadataControl.value.trim();
      meta = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      this.snackBar.open('Invalid JSON in metadata', 'Close', { duration: 3000 });
      return;
    }
    const dim = this.collectionDimension ?? this.dialogData?.dimension ?? DEFAULT_DIMENSION;
    const doc = this.row.document ?? '';
    const embedding = Array(dim).fill(0);
    this.submitting = true;
    this.chroma
      .upsertRecords(collectionId, {
        ids: [this.row.id],
        documents: [doc],
        metadatas: [meta],
        embeddings: [embedding],
      })
      .subscribe({
        next: () => {
          this.snackBar.open('Metadata updated', 'Close', { duration: 3000 });
          this.updated.emit(true);
          this.dialogRef?.close(true);
        },
        error: (err) => {
          this.submitting = false;
          const msg = err?.error?.message ?? err?.message ?? 'Failed to update metadata';
          this.snackBar.open(String(msg), 'Close', { duration: 5000 });
        },
      });
  }
}
