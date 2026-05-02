import { Component, inject, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { VbButtonComponent, VbInputComponent } from 'vbomba-ui';
import { ChromaApiService } from '../../../core/services/chroma-api.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-create-collection-form',
  standalone: true,
  imports: [ReactiveFormsModule, VbInputComponent, VbButtonComponent],
  templateUrl: './create-collection-dialog.component.html',
  styleUrl: './create-collection-dialog.component.scss',
})
export class CreateCollectionDialogComponent {
  private chroma = inject(ChromaApiService);
  private snackBar = inject(MatSnackBar);

  readonly created = output<void>();
  readonly cancelled = output<void>();

  readonly nameControl = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(1)],
  });
  protected readonly submitting = signal(false);

  reset(): void {
    this.nameControl.reset('');
    this.submitting.set(false);
  }

  protected onCancel(): void {
    this.reset();
    this.cancelled.emit();
  }

  submit(): void {
    if (this.nameControl.invalid || this.submitting()) return;
    const name = this.nameControl.value.trim();
    if (!name) return;
    this.submitting.set(true);
    this.chroma.createCollection({ name }).subscribe({
      next: () => {
        this.snackBar.open('Collection created', 'Close', { duration: 3000 });
        this.reset();
        this.created.emit();
      },
      error: (err) => {
        this.submitting.set(false);
        const msg = err?.error?.message ?? err?.message ?? 'Failed to create collection';
        this.snackBar.open(String(msg), 'Close', { duration: 5000 });
      },
    });
  }
}
