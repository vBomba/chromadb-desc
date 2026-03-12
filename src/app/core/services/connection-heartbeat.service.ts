import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { Subscription, interval, switchMap, of, catchError } from 'rxjs';
import { ChromaApiService } from './chroma-api.service';
import { ConfigService } from './config.service';
import { ErrorLogService } from './error-log.service';

export type HeartbeatStatus = 'idle' | 'checking' | 'connected' | 'disconnected';

@Injectable({ providedIn: 'root' })
export class ConnectionHeartbeatService implements OnDestroy {
  private chroma = inject(ChromaApiService);
  private configService = inject(ConfigService);
  private errorLog = inject(ErrorLogService);
  private subscription: Subscription | null = null;

  readonly status = signal<HeartbeatStatus>('idle');
  readonly lastError = signal<string | null>(null);
  readonly lastCheckAt = signal<Date | null>(null);

  /** Start periodic heartbeat. Loads config for interval, then runs every N ms. */
  start(): void {
    if (this.subscription) return;
    this.configService.loadConfig().then((config) => {
      const intervalMs = config.heartbeatIntervalMs ?? 30000;
      this.subscription = interval(intervalMs)
        .pipe(
          switchMap(() => {
            this.status.set('checking');
            return this.chroma.heartbeat().pipe(
              catchError((err) => {
                const { message, detail, hint } = ErrorLogService.messageFromError(err);
                this.lastError.set(detail);
                this.status.set('disconnected');
                this.lastCheckAt.set(new Date());
                this.errorLog.push(`Heartbeat: ${message}`, detail, hint);
                return of(null);
              })
            );
          })
        )
        .subscribe((result) => {
          if (result !== null) {
            this.lastError.set(null);
            this.status.set('connected');
            this.lastCheckAt.set(new Date());
          }
        });
      // Run first check immediately
      this.runCheck();
    });
  }

  /** Run a single check now (without waiting for interval). */
  runCheck(): void {
    this.status.set('checking');
    this.chroma.heartbeat().subscribe({
      next: () => {
        this.lastError.set(null);
        this.status.set('connected');
        this.lastCheckAt.set(new Date());
      },
      error: (err) => {
        const { message, detail, hint } = ErrorLogService.messageFromError(err);
        this.lastError.set(detail);
        this.status.set('disconnected');
        this.lastCheckAt.set(new Date());
        this.errorLog.push(`Heartbeat: ${message}`, detail, hint);
      },
    });
  }

  stop(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    this.status.set('idle');
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
