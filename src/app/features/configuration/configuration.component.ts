import { Component, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { VbButtonComponent, VbChipComponent, VbInputComponent, VbLoaderComponent } from 'vbomba-ui';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfigService } from '../../core/services/config.service';
import { ConnectionHeartbeatService } from '../../core/services/connection-heartbeat.service';

@Component({
  selector: 'app-configuration',
  standalone: true,
  imports: [ReactiveFormsModule, VbInputComponent, VbButtonComponent, VbChipComponent, VbLoaderComponent, MatSnackBarModule],
  templateUrl: './configuration.component.html',
  styleUrl: './configuration.component.scss',
})
export class ConfigurationComponent implements OnInit {
  private static readonly LOADING_GUARD_MS = 12000;
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

  protected saving = signal(false);
  protected loading = signal(true);

  protected patchControl(control: AbstractControl, value: string): void {
    control.setValue(value);
    control.markAsTouched();
  }

  protected heartbeatDisplay(): string {
    return String(this.form.controls.heartbeatIntervalMs.value);
  }

  protected patchHeartbeat(raw: string): void {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) {
      this.form.controls.heartbeatIntervalMs.setValue(n);
    } else {
      this.form.controls.heartbeatIntervalMs.setValue(this.form.controls.heartbeatIntervalMs.value);
    }
    this.form.controls.heartbeatIntervalMs.markAsTouched();
  }

  private patchFromConfig(): Promise<void> {
    return this.configService.loadConfig().then((c) => {
      this.form.patchValue({
        apiBaseUrl: c.apiBaseUrl,
        tenant: c.tenant,
        database: c.database,
        apiKey: c.apiKey ?? '',
        heartbeatIntervalMs: c.heartbeatIntervalMs ?? 30000,
      });
    });
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    const guard = window.setTimeout(() => {
      if (!this.loading()) return;
      this.loading.set(false);
      this.snackBar.open('Config load timed out. Please retry.', 'Close', { duration: 5000 });
    }, ConfigurationComponent.LOADING_GUARD_MS);
    try {
      await this.patchFromConfig();
    } catch {
      this.snackBar.open('Could not load config', 'Close', { duration: 5000 });
    } finally {
      window.clearTimeout(guard);
      this.loading.set(false);
    }
  }

  protected get hasStoredConfig(): boolean {
    return this.configService.hasStoredConfig();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.configService.saveConfig({
      apiBaseUrl: v.apiBaseUrl.trim(),
      tenant: v.tenant.trim(),
      database: v.database.trim(),
      apiKey: v.apiKey?.trim() || null,
      heartbeatIntervalMs: v.heartbeatIntervalMs,
    });
    this.saving.set(false);
    this.snackBar.open('Configuration saved. Restart heartbeat to apply.', 'Close', { duration: 4000 });
    this.heartbeat.stop();
    this.heartbeat.start();
  }

  protected resetToFile(): void {
    this.configService.clearSavedConfig();
    this.snackBar.open('Cleared saved config. Reloading from config.json…', 'Close', { duration: 3000 });
    this.loading.set(true);
    const guard = window.setTimeout(() => {
      if (!this.loading()) return;
      this.loading.set(false);
      this.snackBar.open('Reload timed out. Please retry.', 'Close', { duration: 5000 });
    }, ConfigurationComponent.LOADING_GUARD_MS);
    this.patchFromConfig()
      .then(() => {
        this.heartbeat.stop();
        this.heartbeat.start();
      })
      .catch(() => {
        this.snackBar.open('Failed to load config.json', 'Close', { duration: 5000 });
      })
      .finally(() => {
        window.clearTimeout(guard);
        this.loading.set(false);
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
