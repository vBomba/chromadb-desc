import { Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { ChromaApiService } from '../../core/services/chroma-api.service';

type Status = 'idle' | 'checking' | 'ok' | 'error';

@Component({
  selector: 'app-connection',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  templateUrl: './connection.component.html',
  styleUrl: './connection.component.scss',
})
export class ConnectionComponent {
  private chroma = inject(ChromaApiService);
  protected status = signal<Status>('idle');
  protected errorMessage = signal<string | null>(null);

  protected checkConnection(): void {
    this.status.set('checking');
    this.errorMessage.set(null);
    this.chroma.checkConnection().subscribe({
      next: () => {
        this.status.set('ok');
      },
      error: (err) => {
        this.status.set('error');
        const msg =
          err?.error?.message ??
          err?.message ??
          (typeof err?.status === 'number' ? `HTTP ${err.status}` : 'Unknown error');
        this.errorMessage.set(String(msg));
      },
    });
  }
}
