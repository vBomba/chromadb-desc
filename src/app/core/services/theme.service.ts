import { Injectable, signal, computed } from '@angular/core';

const STORAGE_KEY = 'chromaDesc-theme';
export type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly stored = signal<ThemeMode | null>(this.readStored());
  readonly theme = computed(() => this.stored() ?? 'light');

  setTheme(mode: ThemeMode): void {
    this.stored.set(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {}
    this.applyToDocument(mode);
  }

  toggleTheme(): void {
    const next: ThemeMode = this.theme() === 'light' ? 'dark' : 'light';
    this.setTheme(next);
  }

  private readStored(): ThemeMode | null {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === 'light' || v === 'dark') return v;
    } catch {}
    return null;
  }

  /** Call once on app init to apply stored preference */
  init(): void {
    this.applyToDocument(this.theme());
  }

  private applyToDocument(mode: ThemeMode): void {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.style.colorScheme = mode;
    document.body.classList.toggle('app-dark-theme', mode === 'dark');
    document.body.classList.toggle('app-light-theme', mode === 'light');
  }
}
