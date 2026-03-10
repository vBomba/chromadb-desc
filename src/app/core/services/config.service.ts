import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppConfig } from '../config/app-config.model';

const CONFIG_PATH = 'config.json';
const STORAGE_KEY = 'chromaDesc-config';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private config: AppConfig | null = null;

  constructor(private http: HttpClient) {}

  private envApiKey(): string | null {
    return (typeof (window as unknown as { env?: { ['CHROMA_API_KEY']?: string } }).env?.CHROMA_API_KEY === 'string'
      ? (window as unknown as { env?: { ['CHROMA_API_KEY']?: string } }).env!.CHROMA_API_KEY
      : null) ?? null;
  }

  private normalize(c: Partial<AppConfig>): AppConfig {
    const apiKey = this.envApiKey() ?? c.apiKey ?? null;
    return {
      apiBaseUrl: (c.apiBaseUrl ?? '').replace(/\/$/, ''),
      tenant: c.tenant ?? '',
      database: c.database ?? '',
      apiKey,
      heartbeatIntervalMs: c.heartbeatIntervalMs ?? 30000,
    };
  }

  private readStored(): AppConfig | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const c = JSON.parse(raw) as Partial<AppConfig>;
      if (!c || typeof c.apiBaseUrl !== 'string') return null;
      return this.normalize(c);
    } catch {
      return null;
    }
  }

  async loadConfig(): Promise<AppConfig> {
    const stored = this.readStored();
    if (stored) {
      this.config = stored;
      return this.config;
    }
    if (this.config) return this.config;
    const c = await firstValueFrom(
      this.http.get<AppConfig>(CONFIG_PATH, { responseType: 'json' })
    );
    this.config = this.normalize(c);
    return this.config;
  }

  getConfig(): AppConfig | null {
    return this.config;
  }

  /** Save config to localStorage and use it for subsequent loadConfig(). */
  saveConfig(config: Partial<AppConfig>): void {
    const normalized = this.normalize(config);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          apiBaseUrl: normalized.apiBaseUrl,
          tenant: normalized.tenant,
          database: normalized.database,
          apiKey: normalized.apiKey,
          heartbeatIntervalMs: normalized.heartbeatIntervalMs,
        })
      );
    } catch {}
    this.config = normalized;
  }

  /** Remove saved config from localStorage; next loadConfig() will use config.json. */
  clearSavedConfig(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    this.config = null;
  }

  /** Whether current config comes from localStorage. */
  hasStoredConfig(): boolean {
    return this.readStored() !== null;
  }
}
