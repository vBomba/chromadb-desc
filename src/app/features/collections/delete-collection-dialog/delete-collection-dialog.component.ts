import { Component, inject, input, output, signal } from '@angular/core';
import { VbButtonComponent } from 'vbomba-ui';
import { ChromaApiService, ChromaCollection } from '../../../core/services/chroma-api.service';
import { AppToastService } from '../../../core/services/app-toast.service';

@Component({
  selector: 'app-delete-collection-form',
  standalone: true,
  imports: [VbButtonComponent],
  templateUrl: './delete-collection-dialog.component.html',
  styleUrl: './delete-collection-dialog.component.scss',
})
export class DeleteCollectionDialogComponent {
  private chroma = inject(ChromaApiService);
  private toast = inject(AppToastService);

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
        this.toast.success('Collection deleted', 3000);
        this.deleting.set(false);
        this.deleted.emit();
      },
      error: (err) => {
        this.deleting.set(false);
        const msg = err?.error?.message ?? err?.message ?? 'Failed to delete collection';
        this.toast.error(String(msg));
      },
    });
  }
}
