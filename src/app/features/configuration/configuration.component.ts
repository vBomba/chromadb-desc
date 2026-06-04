import { Component, inject, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  VbAlertComponent,
  VbButtonComponent,
  VbChipComponent,
  VbInputComponent,
  VbLoaderComponent,
  VbSliderComponent,
} from 'vbomba-ui';
import { ConfigService } from '../../core/services/config.service';
import { AppToastService } from '../../core/services/app-toast.service';
import { ConnectionHeartbeatService } from '../../core/services/connection-heartbeat.service';

@Component({
  selector: 'app-configuration',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    VbAlertComponent,
    VbInputComponent,
    VbButtonComponent,
    VbChipComponent,
    VbLoaderComponent,
    VbSliderComponent,
  ],
  templateUrl: './configuration.component.html',
  styleUrl: './configuration.component.scss',
})
export class ConfigurationComponent implements OnInit {
  private fb = inject(FormBuilder);
  private configService = inject(ConfigService);
  private heartbeat = inject(ConnectionHeartbeatService);
  private toast = inject(AppToastService);

  protected form = this.fb.nonNullable.group({
    apiBaseUrl: ['', Validators.required],
    tenant: ['', Validators.required],
    database: ['', Validators.required],
    apiKey: [''],
    heartbeatIntervalMs: [30000, [Validators.required, Validators.min(5000), Validators.max(300000)]],
  });

  protected saving = false;
  protected loading = true;

  protected patchControl(control: AbstractControl, value: string): void {
    control.setValue(value);
    control.markAsTouched();
  }

  protected patchHeartbeat(value: number): void {
    this.form.controls.heartbeatIntervalMs.setValue(value);
    this.form.controls.heartbeatIntervalMs.markAsTouched();
  }

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
      this.toast.error('Could not load config');
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
    this.toast.success('Configuration saved. Restart heartbeat to apply.');
    this.heartbeat.stop();
    this.heartbeat.start();
  }

  protected resetToFile(): void {
    this.configService.clearSavedConfig();
    this.toast.info('Cleared saved config. Reloading from config.json…', 3000);
    this.loading = true;
    this.configService
      .loadConfig()
      .then((c) => {
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
      })
      .catch(() => {
        this.loading = false;
        this.toast.error('Failed to load config.json');
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
    this.toast.success('config.json downloaded', 3000);
  }
}
