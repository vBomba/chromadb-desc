import { Component, inject, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule, MatDrawerMode } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { ThemeService } from '../../core/services/theme.service';
import { ConnectionHeartbeatService } from '../../core/services/connection-heartbeat.service';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatListModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.scss',
})
export class DashboardLayoutComponent implements OnInit {
  private breakpoints = inject(BreakpointObserver);
  protected themeService = inject(ThemeService);
  protected heartbeat = inject(ConnectionHeartbeatService);

  ngOnInit(): void {
    this.heartbeat.start();
  }

  protected isHandset = toSignal(
    this.breakpoints.observe(Breakpoints.Handset).pipe(
      map((r) => r.matches)
    ),
    { initialValue: false }
  );

  protected sidenavMode = toSignal(
    this.breakpoints.observe(Breakpoints.Handset).pipe(
      map((r) => (r.matches ? 'over' : 'side') as MatDrawerMode)
    ),
    { initialValue: 'side' as MatDrawerMode }
  );

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
