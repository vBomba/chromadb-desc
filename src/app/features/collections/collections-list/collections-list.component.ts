import { Component, inject, signal, OnInit, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { ViewChild } from '@angular/core';
import { MatSort } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ChromaApiService, ChromaCollection } from '../../../core/services/chroma-api.service';
import { ErrorLogService } from '../../../core/services/error-log.service';
import { CreateCollectionDialogComponent } from '../create-collection-dialog/create-collection-dialog.component';
import { DeleteCollectionDialogComponent } from '../delete-collection-dialog/delete-collection-dialog.component';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-collections-list',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSortModule,
  ],
  templateUrl: './collections-list.component.html',
  styleUrl: './collections-list.component.scss',
})
export class CollectionsListComponent implements OnInit, AfterViewInit {
  private chroma = inject(ChromaApiService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private errorLog = inject(ErrorLogService);

  protected loading = signal(true);
  protected dataSource = new MatTableDataSource<ChromaCollection>([]);
  protected readonly displayedColumns = ['name', 'id', 'dimension', 'count', 'actions'];

  protected filterTenant = '';
  protected filterDatabase = '';
  protected filterText = '';
  private lastLoaded: ChromaCollection[] = [];
  private filterDebounceHandle: number | null = null;
  protected counts = new Map<string, number>();

  @ViewChild(MatSort, { static: false }) sort?: MatSort;

  ngOnInit(): void {
    this.dataSource.filterPredicate = (data: ChromaCollection, raw: string): boolean => {
      if (!raw) return true;
      let parsed: { tenant: string; database: string; text: string };
      try {
        parsed = JSON.parse(raw) as { tenant: string; database: string; text: string };
      } catch {
        return true;
      }
      const tenant = (data.tenant ?? '').toString().toLowerCase();
      const database = (data.database ?? '').toString().toLowerCase();
      const name = (data.name ?? '').toString().toLowerCase();
      const id = (data.id ?? '').toString().toLowerCase();

      const tenantOk = !parsed.tenant || tenant.includes(parsed.tenant);
      const databaseOk = !parsed.database || database.includes(parsed.database);
      const textOk =
        !parsed.text || name.includes(parsed.text) || id.includes(parsed.text);

      return tenantOk && databaseOk && textOk;
    };

    this.load();
  }

  ngAfterViewInit(): void {
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
  }

  protected load(): void {
    this.loading.set(true);
    this.chroma.listCollections(500, 0).subscribe({
      next: (list) => {
        this.lastLoaded = list;
        this.dataSource.data = list;
        this.applyFilters();
        this.loading.set(false);
        this.loadCountsForCollections(list);
      },
      error: (err) => {
        this.loading.set(false);
        const { message, detail, hint } = ErrorLogService.messageFromError(err);
        this.errorLog.push(`Collections: ${message}`, detail, hint);
        this.snackBar.open('Failed to load collections', 'Close', { duration: 5000 });
      },
    });
  }

  private loadCountsForCollections(list: ChromaCollection[]): void {
    this.counts.clear();
    for (const c of list) {
      this.chroma.countRecords(c.id).subscribe({
        next: (res) => {
          this.counts.set(c.id, res.count ?? 0);
        },
        error: () => {
          // Ignore count errors for now.
        },
      });
    }
  }

  protected getCountFor(row: ChromaCollection): number | string {
    const v = this.counts.get(row.id);
    return typeof v === 'number' ? v : '…';
  }

  protected openCollection(c: ChromaCollection): void {
    this.router.navigate(['/collections', c.id, 'documents']);
  }

  protected applyFilters(): void {
    if (this.filterDebounceHandle != null) {
      window.clearTimeout(this.filterDebounceHandle);
    }

    this.filterDebounceHandle = window.setTimeout(() => {
      const tenant = this.filterTenant.trim();
      const database = this.filterDatabase.trim();
      const collection = this.filterText.trim();

      // If all CRN parts are non-empty, fetch directly by CRN.
      if (tenant && database && collection) {
        const crn = `${tenant}:${database}:${collection}`;
        this.loading.set(true);
        this.chroma.getCollectionByCrn(crn).subscribe({
          next: (c) => {
            this.dataSource.data = [c];
            this.loading.set(false);
          },
          error: (err) => {
            this.dataSource.data = [];
            this.loading.set(false);
            const { message, detail, hint } = ErrorLogService.messageFromError(err);
            this.errorLog.push(`CRN: ${message}`, detail, hint ?? 'Перевірте tenant:database:collection.');
            this.snackBar.open('Collection not found (CRN)', 'Close', { duration: 4000 });
          },
        });
        return;
      }

      // Otherwise, apply client-side filtering on the last loaded list.
      this.dataSource.data = this.lastLoaded;
      const payload = {
        tenant: tenant.toLowerCase(),
        database: database.toLowerCase(),
        text: collection.toLowerCase(),
      };
      this.dataSource.filter = JSON.stringify(payload);
    }, 300);
  }

  protected openCreateDialog(): void {
    const ref = this.dialog.open(CreateCollectionDialogComponent, {
      width: '400px',
    });
    ref.afterClosed().subscribe((created) => {
      if (created) this.load();
    });
  }

  protected copyId(id: string, event?: Event): void {
    if (event) (event as Event).stopPropagation();
    navigator.clipboard.writeText(id).then(
      () => this.snackBar.open('ID copied', 'Close', { duration: 2000 }),
      () => this.snackBar.open('Copy failed', 'Close', { duration: 3000 })
    );
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
