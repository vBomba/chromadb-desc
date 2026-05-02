import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
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
  imports: [MatDialogModule, VbButtonComponent],
  templateUrl: './delete-document-dialog.component.html',
  styleUrl: './delete-document-dialog.component.scss',
})
export class DeleteDocumentDialogComponent {
  private dialogRef = inject(MatDialogRef<DeleteDocumentDialogComponent>);
  private chroma = inject(ChromaApiService);
  private snackBar = inject(MatSnackBar);
  protected data = inject<DeleteDocumentDialogData>(MAT_DIALOG_DATA);

  protected deleting = false;

  protected get row(): DocumentRow {
    return this.data.documentRow;
  }

  protected cancel(): void {
    this.dialogRef.close(false);
  }

  protected confirm(): void {
    if (this.deleting) return;
    this.deleting = true;
    this.chroma.deleteRecords(this.data.collectionId, { ids: [this.row.id] }).subscribe({
      next: () => {
        this.snackBar.open('Document deleted', 'Close', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.deleting = false;
        const msg = err?.error?.message ?? err?.message ?? 'Failed to delete document';
        this.snackBar.open(String(msg), 'Close', { duration: 5000 });
      },
    });
  }
}
