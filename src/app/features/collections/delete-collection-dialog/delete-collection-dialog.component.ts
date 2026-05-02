import { Component, inject, input, output, signal } from '@angular/core';
import { VbButtonComponent } from 'vbomba-ui';
import { ChromaApiService, ChromaCollection } from '../../../core/services/chroma-api.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-delete-collection-form',
  standalone: true,
  imports: [VbButtonComponent],
  templateUrl: './delete-collection-dialog.component.html',
  styleUrl: './delete-collection-dialog.component.scss',
})
export class DeleteCollectionDialogComponent {
  private chroma = inject(ChromaApiService);
  private snackBar = inject(MatSnackBar);

  readonly collection = input.required<ChromaCollection>();
  readonly deleted = output<void>();
  readonly cancelled = output<void>();

  protected deleting = signal(false);

  protected cancel(): void {
    this.cancelled.emit();
  }

  protected confirm(): void {
    if (this.deleting()) return;
    const c = this.collection();
    this.deleting.set(true);
    this.chroma.deleteCollection(c.id).subscribe({
      next: () => {
        this.snackBar.open('Collection deleted', 'Close', { duration: 3000 });
        this.deleting.set(false);
        this.deleted.emit();
      },
      error: (err) => {
        this.deleting.set(false);
        const msg = err?.error?.message ?? err?.message ?? 'Failed to delete collection';
        this.snackBar.open(String(msg), 'Close', { duration: 5000 });
      },
    });
  }
}
