import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfigService } from '../../core/services/config.service';
import { ConnectionHeartbeatService } from '../../core/services/connection-heartbeat.service';

@Component({
  selector: 'app-configuration',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule,
  ],
  templateUrl: './configuration.component.html',
  styleUrl: './configuration.component.scss',
})
export class ConfigurationComponent implements OnInit {
  private fb = inject(FormBuilder);
  private configService = inject(ConfigService);
  private heartbeat = inject(ConnectionHeartbeatService);
  private snackBar = inject(MatSnackBar);

  protected form = this.fb.nonNullable.group({
    apiBaseUrl: ['', Validators.required],
    tenant: ['', Validators.required],
    database: ['', Validators.required],
    apiKey: [''],
    heartbeatIntervalMs: [30000, [Validators.required, Validators.min(5000), Validators.max(300000)]],
  });

  protected saving = false;
  protected loading = true;

  async ngOnInit(): Promise<void> {
    try {
      const c = await this.configService.loadConfig();
      this.form.patchValue({
        apiBaseUrl: c.apiBaseUrl,
        tenant: c.tenant,
        database: c.database,
        apiKey: c.apiKey ?? '',
        heartbeatIntervalMs: c.heartbeatIntervalMs ?? 30000,
      });
    } catch {
      this.snackBar.open('Could not load config', 'Close', { duration: 5000 });
    } finally {
      this.loading = false;
    }
  }

  protected get hasStoredConfig(): boolean {
    return this.configService.hasStoredConfig();
  }

  protected save(): void {
    if (this.form.invalid || this.saving) return;
    this.saving = true;
    const v = this.form.getRawValue();
    this.configService.saveConfig({
      apiBaseUrl: v.apiBaseUrl.trim(),
      tenant: v.tenant.trim(),
      database: v.database.trim(),
      apiKey: v.apiKey?.trim() || null,
      heartbeatIntervalMs: v.heartbeatIntervalMs,
    });
    this.saving = false;
    this.snackBar.open('Configuration saved. Restart heartbeat to apply.', 'Close', { duration: 4000 });
    this.heartbeat.stop();
    this.heartbeat.start();
  }

  protected resetToFile(): void {
    this.configService.clearSavedConfig();
    this.snackBar.open('Cleared saved config. Reloading from config.json…', 'Close', { duration: 3000 });
    this.loading = true;
    this.configService.loadConfig().then((c) => {
      this.form.patchValue({
        apiBaseUrl: c.apiBaseUrl,
        tenant: c.tenant,
        database: c.database,
        apiKey: c.apiKey ?? '',
        heartbeatIntervalMs: c.heartbeatIntervalMs ?? 30000,
      });
      this.loading = false;
      this.heartbeat.stop();
      this.heartbeat.start();
    }).catch(() => {
      this.loading = false;
      this.snackBar.open('Failed to load config.json', 'Close', { duration: 5000 });
    });
  }

  protected exportFile(): void {
    const v = this.form.getRawValue();
    const blob = new Blob(
      [
        JSON.stringify(
          {
            apiBaseUrl: v.apiBaseUrl.trim(),
            tenant: v.tenant.trim(),
            database: v.database.trim(),
            apiKey: v.apiKey?.trim() || null,
            heartbeatIntervalMs: v.heartbeatIntervalMs,
          },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'config.json';
    a.click();
    URL.revokeObjectURL(a.href);
    this.snackBar.open('config.json downloaded', 'Close', { duration: 3000 });
  }
}
