import {
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule, MatSidenavContainer, MatDrawerMode } from '@angular/material/sidenav';
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
  private cdr = inject(ChangeDetectorRef);
  protected themeService = inject(ThemeService);
  protected heartbeat = inject(ConnectionHeartbeatService);

  @ViewChild('drawerContainer') private drawerContainer?: MatSidenavContainer;

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
  protected readonly sidenavOpened = signal(!this.isHandset());
  protected readonly sidenavCollapsed = signal(false);
  protected readonly menuIconClass = computed(() => {
    if (this.isHandset()) {
      return this.sidenavOpened() ? 'bx bx-menu-alt-right' : 'bx bx-menu';
    }
    return this.sidenavCollapsed() ? 'bx bx-menu' : 'bx bx-menu-alt-right';
  });

  constructor() {
    effect(() => {
      const mobile = this.isHandset();
      this.sidenavOpened.set(!mobile);
      this.sidenavCollapsed.set(false);
      queueMicrotask(() => this.flushDrawerMargins());
    });
  }

  protected toggleSidenav(): void {
    if (this.isHandset()) {
      this.sidenavOpened.set(!this.sidenavOpened());
      this.flushDrawerMargins();
      return;
    }
    this.sidenavCollapsed.set(!this.sidenavCollapsed());
    this.sidenavOpened.set(true);
    this.flushDrawerMargins();
  }

  /**
   * Collapse/expand only toggles a CSS class; Material still debounces margin updates (10ms).
   * Re-measure immediately after the view reflects the new drawer width so main starts with the menu.
   */
  private flushDrawerMargins(): void {
    this.cdr.detectChanges();
    this.drawerContainer?.updateContentMargins();
  }

  protected onSidenavOpenedChange(opened: boolean): void {
    this.sidenavOpened.set(opened);
  }

  protected onNavigate(): void {
    if (this.isHandset()) {
      this.sidenavOpened.set(false);
    }
  }

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
