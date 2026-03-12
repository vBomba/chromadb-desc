import { Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ChromaApiService, ChecklistResponse } from '../../core/services/chroma-api.service';

@Component({
  selector: 'app-server-status',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './server-status.component.html',
  styleUrl: './server-status.component.scss',
})
export class ServerStatusComponent {
  private chroma = inject(ChromaApiService);

  protected loading = signal(true);
  protected version = signal<string | null>(null);
  protected versionError = signal<string | null>(null);
  protected healthcheck = signal<string | null>(null);
  protected healthcheckError = signal<string | null>(null);
  protected preflight = signal<ChecklistResponse | null>(null);
  protected preflightError = signal<string | null>(null);
  protected collectionsCount = signal<number | null>(null);
  protected collectionsCountError = signal<string | null>(null);

  constructor() {
    this.refresh();
  }

  protected refresh(): void {
    this.loading.set(true);
    this.versionError.set(null);
    this.healthcheckError.set(null);
    this.preflightError.set(null);
    this.collectionsCountError.set(null);

    this.chroma.getVersion().subscribe({
      next: (v) => {
        this.version.set(v);
      },
      error: (e) => {
        this.versionError.set(this.messageFromError(e));
      },
    });

    this.chroma.getHealthcheck().subscribe({
      next: (v) => {
        this.healthcheck.set(v);
      },
      error: (e) => {
        this.healthcheckError.set(this.messageFromError(e));
      },
    });

    this.chroma.getPreFlightChecks().subscribe({
      next: (v) => {
        this.preflight.set(v);
      },
      error: (e) => {
        this.preflightError.set(this.messageFromError(e));
      },
    });

    this.chroma.getCollectionsCount().subscribe({
      next: (v) => {
        this.collectionsCount.set(typeof v === 'object' && v != null && 'count' in v ? (v as { count: number }).count : Number(v));
      },
      error: (e) => {
        this.collectionsCountError.set(this.messageFromError(e));
      },
    });

    // Consider loaded after a short delay so all requests had a chance
    setTimeout(() => this.loading.set(false), 800);
  }

  private messageFromError(err: unknown): string {
    const msg =
      (err as { error?: { message?: string }; message?: string })?.error?.message ??
      (err as { message?: string })?.message ??
      (typeof (err as { status?: number })?.status === 'number'
        ? `HTTP ${(err as { status: number }).status}`
        : 'Unknown error');
    return String(msg);
  }
}
