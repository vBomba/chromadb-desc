import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { VbButtonComponent, VbLoaderComponent } from 'vbomba-ui';
import { ConnectionHeartbeatService } from '../../core/services/connection-heartbeat.service';
import { ChromaApiService, ChromaDatabase } from '../../core/services/chroma-api.service';

@Component({
  selector: 'app-connection',
  standalone: true,
  imports: [DatePipe, VbButtonComponent, VbLoaderComponent],
  templateUrl: './connection.component.html',
  styleUrl: './connection.component.scss',
})
export class ConnectionComponent implements OnInit {
  protected heartbeat = inject(ConnectionHeartbeatService);
  private chroma = inject(ChromaApiService);

  protected dbLoading = signal(false);
  protected dbError = signal<string | null>(null);
  protected database = signal<ChromaDatabase | null>(null);

  ngOnInit(): void {
    this.loadDatabaseInfo();
  }

  protected checkConnection(): void {
    this.heartbeat.runCheck();
  }

  protected loadDatabaseInfo(): void {
    this.dbLoading.set(true);
    this.dbError.set(null);
    this.chroma.getCurrentDatabase().subscribe({
      next: (db) => {
        this.database.set(db);
        this.dbLoading.set(false);
      },
      error: (err) => {
        const msg =
          err?.error?.message ??
          err?.message ??
          (typeof err?.status === 'number' ? `HTTP ${err.status}` : 'Unknown error');
        this.dbError.set(String(msg));
        this.dbLoading.set(false);
      },
    });
  }
}
