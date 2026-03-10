import { Component, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ChromaApiService } from '../../../core/services/chroma-api.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-create-collection-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    ReactiveFormsModule,
  ],
  templateUrl: './create-collection-dialog.component.html',
  styleUrl: './create-collection-dialog.component.scss',
})
export class CreateCollectionDialogComponent {
  private dialogRef = inject(MatDialogRef<CreateCollectionDialogComponent>);
  private chroma = inject(ChromaApiService);
  private snackBar = inject(MatSnackBar);

  protected nameControl = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(1)],
  });
  protected submitting = false;

  protected cancel(): void {
    this.dialogRef.close(false);
  }

  protected submit(): void {
    if (this.nameControl.invalid || this.submitting) return;
    const name = this.nameControl.value.trim();
    if (!name) return;
    this.submitting = true;
    this.chroma.createCollection({ name }).subscribe({
      next: () => {
        this.snackBar.open('Collection created', 'Close', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.submitting = false;
        const msg = err?.error?.message ?? err?.message ?? 'Failed to create collection';
        this.snackBar.open(String(msg), 'Close', { duration: 5000 });
      },
    });
  }
}
