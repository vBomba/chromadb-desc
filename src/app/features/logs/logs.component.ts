import { Component, computed, inject } from '@angular/core';
import { formatDate } from '@angular/common';
import { VbButtonComponent, VbSimpleTableComponent, type VbSimpleTableColumn } from 'vbomba-ui';
import { ErrorLogService, LogEntry } from '../../core/services/error-log.service';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [VbButtonComponent, VbSimpleTableComponent],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.scss',
})
export class LogsComponent {
  protected errorLog = inject(ErrorLogService);

  protected readonly logColumns: VbSimpleTableColumn[] = [
    { key: 'at', label: 'Time' },
    { key: 'message', label: 'Message' },
    { key: 'detail', label: 'Details', sortable: false },
    { key: 'hint', label: 'Hint', sortable: false },
  ];

  protected readonly logRows = computed(() =>
    this.errorLog.logs().map((e) => this.rowToRecord(e))
  );

  private rowToRecord(e: LogEntry): Record<string, unknown> {
    return {
      at: formatDate(e.at, 'short', 'en-US'),
      message: e.message,
      detail: e.detail,
      hint: e.hint ?? '—',
    };
  }

  protected clear(): void {
    this.errorLog.clear();
  }
}
