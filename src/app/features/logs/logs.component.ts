import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { ErrorLogService, LogEntry } from '../../core/services/error-log.service';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
  ],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss',
})
export class LogsComponent {
  protected errorLog = inject(ErrorLogService);
  protected displayedColumns: (keyof LogEntry)[] = ['at', 'message', 'detail', 'hint'];

  protected clear(): void {
    this.errorLog.clear();
  }
}
