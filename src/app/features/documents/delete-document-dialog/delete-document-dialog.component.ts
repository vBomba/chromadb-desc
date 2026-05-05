import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { VbButtonComponent } from 'vbomba-ui';
import { ChromaApiService } from '../../../core/services/chroma-api.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DocumentRow } from '../document-row.model';

export interface DeleteDocumentDialogData {
  collectionId: string;
  documentRow: DocumentRow;
}

@Component({
  selector: 'app-delete-document-dialog',
  standalone: true,
  imports: [VbButtonComponent],
  templateUrl: './delete-document-dialog.component.html',
  styleUrl: './delete-document-dialog.component.scss',
})
export class DeleteDocumentDialogComponent {
  private dialogRef = inject(MatDialogRef<DeleteDocumentDialogComponent>, { optional: true });
  private chroma = inject(ChromaApiService);
  private snackBar = inject(MatSnackBar);
  private dialogData = inject<DeleteDocumentDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  @Input() collectionId: string | null = null;
  @Input() documentRow: DocumentRow | null = null;
  @Output() deleted = new EventEmitter<boolean>();
  @Output() cancelled = new EventEmitter<void>();

  protected deleting = false;

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

  protected cancel(): void {
    this.cancelled.emit();
    this.dialogRef?.close(false);
  }

  protected confirm(): void {
    if (this.deleting) return;
    const collectionId = this.collectionId ?? this.dialogData?.collectionId ?? null;
    if (!collectionId) return;
    this.deleting = true;
    this.chroma.deleteRecords(collectionId, { ids: [this.row.id] }).subscribe({
      next: () => {
        this.snackBar.open('Document deleted', 'Close', { duration: 3000 });
        this.deleted.emit(true);
        this.dialogRef?.close(true);
      },
      error: (err) => {
        this.deleting = false;
        const msg = err?.error?.message ?? err?.message ?? 'Failed to delete document';
        this.snackBar.open(String(msg), 'Close', { duration: 5000 });
      },
    });
  }
}
