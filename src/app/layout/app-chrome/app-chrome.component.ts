import { Component, OnInit, inject } from '@angular/core';
import { VbAppShellComponent } from 'vbomba-ui';
import { ShellHeartbeatComponent } from '../shell-heartbeat/shell-heartbeat.component';
import { ConnectionHeartbeatService } from '../../core/services/connection-heartbeat.service';

@Component({
  selector: 'app-chrome',
  standalone: true,
  imports: [VbAppShellComponent, ShellHeartbeatComponent],
  templateUrl: './app-chrome.component.html',
  styleUrl: './app-chrome.component.scss',
})
export class AppChromeComponent implements OnInit {
  private heartbeat = inject(ConnectionHeartbeatService);

  ngOnInit(): void {
    this.heartbeat.start();
  }
}
