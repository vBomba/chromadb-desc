import { Injectable, signal } from '@angular/core';

export interface LogEntry {
  id: number;
  at: Date;
  message: string;
  detail: string;
  hint: string | null;
}

const MAX_ENTRIES = 100;

@Injectable({ providedIn: 'root' })
export class ErrorLogService {
  private nextId = 1;
  private entries: LogEntry[] = [];

  readonly logs = signal<LogEntry[]>([]);

  push(message: string, detail: string, hint: string | null = null): void {
    const entry: LogEntry = {
      id: this.nextId++,
      at: new Date(),
      message,
      detail,
      hint,
    };
    this.entries.unshift(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.length = MAX_ENTRIES;
    }
    this.logs.set([...this.entries]);
  }

  clear(): void {
    this.entries.length = 0;
    this.logs.set([]);
  }

  /** Build user-friendly message and optional hint from HTTP/API error. */
  static messageFromError(err: unknown): { message: string; detail: string; hint: string | null } {
    const e = err as {
      error?: { message?: string; error?: string };
      message?: string;
      status?: number;
    };
    const detail =
      e?.error?.message ?? e?.message ?? (e?.status != null ? `HTTP ${e.status}` : 'Unknown error');
    const message = 'Request failed';
    let hint: string | null = null;
    if (e?.status === 401) {
      hint = 'Перевірте API key (Configuration → API key).';
    } else if (e?.status === 404) {
      hint = 'Перевірте tenant та database в Configuration.';
    } else if (e?.status === 0 || (typeof detail === 'string' && detail.toLowerCase().includes('fetch'))) {
      hint = 'Можлива CORS або мережа. Спробуйте локальний проксі (proxy.conf.js).';
    }
    return { message, detail: String(detail), hint };
  }
}
