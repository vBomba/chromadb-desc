import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ChromaApiService } from '../../../core/services/chroma-api.service';
import { MatSnackBar } from '@angular/material/snack-bar';

const DEFAULT_DIMENSION = 384;

export interface AddDocumentDialogData {
  collectionId: string;
  dimension: number | null;
}

@Component({
  selector: 'app-add-document-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    ReactiveFormsModule,
  ],
  templateUrl: './add-document-dialog.component.html',
  styleUrl: './add-document-dialog.component.scss',
})
export class AddDocumentDialogComponent {
  private dialogRef = inject(MatDialogRef<AddDocumentDialogComponent>);
  private chroma = inject(ChromaApiService);
  private snackBar = inject(MatSnackBar);
  protected data = inject<AddDocumentDialogData>(MAT_DIALOG_DATA);

  protected idControl = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(1)],
  });
  protected documentControl = new FormControl<string>('', { nonNullable: true });
  protected metadataControl = new FormControl<string>('{}', { nonNullable: true });
  protected submitting = false;

  protected get dimension(): number {
    return this.data.dimension ?? DEFAULT_DIMENSION;
  }

  protected cancel(): void {
    this.dialogRef.close(false);
  }

  protected submit(): void {
    if (this.idControl.invalid || this.submitting) return;
    const id = this.idControl.value.trim();
    const document = this.documentControl.value.trim() || null;
    let metadatas: (Record<string, unknown> | null)[] = [null];
    try {
      const raw = this.metadataControl.value.trim();
      metadatas = [raw ? (JSON.parse(raw) as Record<string, unknown>) : null];
    } catch {
      this.snackBar.open('Invalid JSON in metadata', 'Close', { duration: 3000 });
      return;
    }
    const dim = this.dimension;
    const embeddings = [Array(dim).fill(0)];
    this.submitting = true;
    this.chroma
      .addRecords(this.data.collectionId, {
        ids: [id],
        documents: document !== null ? [document] : undefined,
        metadatas,
        embeddings,
      })
      .subscribe({
        next: () => {
          this.snackBar.open('Document added', 'Close', { duration: 3000 });
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.submitting = false;
          const msg = err?.error?.message ?? err?.message ?? 'Failed to add document';
          this.snackBar.open(String(msg), 'Close', { duration: 5000 });
        },
      });
  }
}
