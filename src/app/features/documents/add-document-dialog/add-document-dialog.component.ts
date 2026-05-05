import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { VbButtonComponent, VbInputComponent, VbTextareaComponent } from 'vbomba-ui';
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
    ReactiveFormsModule,
    VbInputComponent,
    VbTextareaComponent,
    VbButtonComponent,
  ],
  templateUrl: './add-document-dialog.component.html',
  styleUrl: './add-document-dialog.component.scss',
})
export class AddDocumentDialogComponent {
  private dialogRef = inject(MatDialogRef<AddDocumentDialogComponent>, { optional: true });
  private chroma = inject(ChromaApiService);
  private snackBar = inject(MatSnackBar);
  private dialogData = inject<AddDocumentDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  @Input() collectionId: string | null = null;
  @Input() collectionDimension: number | null = null;
  @Output() added = new EventEmitter<boolean>();
  @Output() cancelled = new EventEmitter<void>();

  protected idControl = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(1)],
  });
  protected documentControl = new FormControl<string>('', { nonNullable: true });
  protected metadataControl = new FormControl<string>('{}', { nonNullable: true });
  protected submitting = false;

  protected get dimension(): number {
    return this.collectionDimension ?? this.dialogData?.dimension ?? DEFAULT_DIMENSION;
  }

  protected get hasUnknownDimension(): boolean {
    return (this.collectionDimension ?? this.dialogData?.dimension) == null;
  }

  private effectiveCollectionId(): string | null {
    return this.collectionId ?? this.dialogData?.collectionId ?? null;
  }

  protected cancel(): void {
    this.cancelled.emit();
    this.dialogRef?.close(false);
  }

  protected submit(): void {
    if (this.idControl.invalid || this.submitting) return;
    const collectionId = this.effectiveCollectionId();
    if (!collectionId) return;
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
      .addRecords(collectionId, {
        ids: [id],
        documents: document !== null ? [document] : undefined,
        metadatas,
        embeddings,
      })
      .subscribe({
        next: () => {
          this.snackBar.open('Document added', 'Close', { duration: 3000 });
          this.added.emit(true);
          this.dialogRef?.close(true);
        },
        error: (err) => {
          this.submitting = false;
          const msg = err?.error?.message ?? err?.message ?? 'Failed to add document';
          this.snackBar.open(String(msg), 'Close', { duration: 5000 });
        },
      });
  }
}
