import { Component, inject } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { VbLoaderComponent } from 'vbomba-ui';
import { ConnectionHeartbeatService } from '../../core/services/connection-heartbeat.service';

@Component({
  selector: 'app-shell-heartbeat',
  standalone: true,
  imports: [MatTooltipModule, VbLoaderComponent],
  templateUrl: './shell-heartbeat.component.html',
  styleUrl: './shell-heartbeat.component.scss',
})
export class ShellHeartbeatComponent {
  protected heartbeat = inject(ConnectionHeartbeatService);

  protected heartbeatTooltip(): string {
    const status = this.heartbeat.status();
    const last = this.heartbeat.lastCheckAt();
    const err = this.heartbeat.lastError();
    const timeStr = last ? `Last check: ${last.toLocaleTimeString()}` : '';
    switch (status) {
      case 'checking':
        return 'Checking connection…';
      case 'connected':
        return timeStr ? `Connected. ${timeStr}` : 'Connected';
      case 'disconnected':
        return err ? `Disconnected: ${err}. ${timeStr}` : `Disconnected. ${timeStr}`;
      default:
        return 'Connection heartbeat';
    }
  }
}
