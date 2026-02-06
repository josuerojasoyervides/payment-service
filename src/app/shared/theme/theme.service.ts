import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'theme';

  readonly mode = signal<ThemeMode>('dark');

  constructor() {
    const initial = this.readStoredMode() ?? 'dark';
    this.applyMode(initial, false);
  }

  toggle(): void {
    this.applyMode(this.mode() === 'dark' ? 'light' : 'dark');
  }

  setMode(mode: ThemeMode): void {
    this.applyMode(mode);
  }

  private readStoredMode(): ThemeMode | null {
    if (typeof window === 'undefined') return null;
    try {
      const stored = window.localStorage.getItem(this.storageKey);
      return stored === 'light' || stored === 'dark' ? stored : null;
    } catch {
      return null;
    }
  }

  private applyMode(mode: ThemeMode, persist = true): void {
    this.mode.set(mode);
    const root = this.document.documentElement;
    root.dataset['theme'] = mode;
    root.style.colorScheme = mode;

    if (!persist || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(this.storageKey, mode);
    } catch {
      return;
    }
  }
}
