import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule, MatDrawerMode } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { ThemeService } from '../../core/services/theme.service';

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
  ],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.scss',
})
export class DashboardLayoutComponent {
  private breakpoints = inject(BreakpointObserver);
  protected themeService = inject(ThemeService);

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
}
