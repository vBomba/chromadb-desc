import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ChromaApiService, ChromaCollection } from '../../../core/services/chroma-api.service';
import { CreateCollectionDialogComponent } from '../create-collection-dialog/create-collection-dialog.component';
import { DeleteCollectionDialogComponent } from '../delete-collection-dialog/delete-collection-dialog.component';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-collections-list',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './collections-list.component.html',
  styleUrl: './collections-list.component.scss',
})
export class CollectionsListComponent implements OnInit {
  private chroma = inject(ChromaApiService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  protected loading = signal(true);
  protected dataSource = new MatTableDataSource<ChromaCollection>([]);
  protected readonly displayedColumns = ['name', 'id', 'dimension', 'actions'];

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.chroma.listCollections(500, 0).subscribe({
      next: (list) => {
        this.dataSource.data = list;
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Failed to load collections', 'Close', { duration: 5000 });
      },
    });
  }

  protected openCollection(c: ChromaCollection): void {
    this.router.navigate(['/collections', c.id, 'documents']);
  }

  protected openCreateDialog(): void {
    const ref = this.dialog.open(CreateCollectionDialogComponent, {
      width: '400px',
    });
    ref.afterClosed().subscribe((created) => {
      if (created) this.load();
    });
  }

  protected openDeleteDialog(collection: ChromaCollection): void {
    const ref = this.dialog.open(DeleteCollectionDialogComponent, {
      width: '400px',
      data: { collection },
    });
    ref.afterClosed().subscribe((deleted) => {
      if (deleted) this.load();
    });
  }
}
