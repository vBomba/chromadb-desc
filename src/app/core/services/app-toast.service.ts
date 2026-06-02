import { Injectable, inject } from '@angular/core';
import { VbToastStackService, type VbAlertTone } from 'vbomba-ui';

@Injectable({ providedIn: 'root' })
export class AppToastService {
  private toasts = inject(VbToastStackService);

  show(message: string, tone: VbAlertTone = 'neutral', durationMs = 5200): void {
    this.toasts.show({ message, tone, durationMs });
  }

  success(message: string, durationMs = 4200): void {
    this.show(message, 'success', durationMs);
  }

  error(message: string, durationMs = 7000): void {
    this.show(message, 'error', durationMs);
  }

  warn(message: string, durationMs = 7000): void {
    this.show(message, 'warn', durationMs);
  }

  info(message: string, durationMs = 5200): void {
    this.show(message, 'info', durationMs);
  }
}
