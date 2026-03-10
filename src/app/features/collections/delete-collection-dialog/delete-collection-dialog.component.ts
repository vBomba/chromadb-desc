import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ChromaApiService } from '../../../core/services/chroma-api.service';
import { ChromaCollection } from '../../../core/services/chroma-api.service';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface DeleteCollectionDialogData {
  collection: ChromaCollection;
}

@Component({
  selector: 'app-delete-collection-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './delete-collection-dialog.component.html',
  styleUrl: './delete-collection-dialog.component.scss',
})
export class DeleteCollectionDialogComponent {
  private dialogRef = inject(MatDialogRef<DeleteCollectionDialogComponent>);
  private chroma = inject(ChromaApiService);
  private snackBar = inject(MatSnackBar);
  protected data = inject<DeleteCollectionDialogData>(MAT_DIALOG_DATA);

  protected deleting = false;

  protected get collection(): ChromaCollection {
    return this.data.collection;
  }

  protected cancel(): void {
    this.dialogRef.close(false);
  }

  protected confirm(): void {
    if (this.deleting) return;
    this.deleting = true;
    this.chroma.deleteCollection(this.collection.id).subscribe({
      next: () => {
        this.snackBar.open('Collection deleted', 'Close', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.deleting = false;
        const msg = err?.error?.message ?? err?.message ?? 'Failed to delete collection';
        this.snackBar.open(String(msg), 'Close', { duration: 5000 });
      },
    });
  }
}
