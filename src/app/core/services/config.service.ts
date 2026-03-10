import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppConfig } from '../config/app-config.model';

const CONFIG_PATH = 'config.json';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private config: AppConfig | null = null;

  constructor(private http: HttpClient) {}

  async loadConfig(): Promise<AppConfig> {
    if (this.config) return this.config;
    const c = await firstValueFrom(
      this.http.get<AppConfig>(CONFIG_PATH, { responseType: 'json' })
    );
    const apiKey =
      (typeof (window as unknown as { env?: { ['CHROMA_API_KEY']?: string } }).env?.CHROMA_API_KEY === 'string'
        ? (window as unknown as { env?: { ['CHROMA_API_KEY']?: string } }).env!.CHROMA_API_KEY
        : null) ?? c.apiKey ?? null;
    this.config = {
      apiBaseUrl: (c.apiBaseUrl ?? '').replace(/\/$/, ''),
      tenant: c.tenant ?? '',
      database: c.database ?? '',
      apiKey,
      heartbeatIntervalMs: c.heartbeatIntervalMs ?? 30000,
    };
    return this.config;
  }

  getConfig(): AppConfig | null {
    return this.config;
  }
}
