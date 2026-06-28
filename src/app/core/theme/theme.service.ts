import { Service, signal, computed, effect } from '@angular/core';

export type ColorScheme = 'light' | 'dark';

const STORAGE_KEY = 'et_color_scheme';

@Service()
export class ThemeService {
  private readonly _scheme = signal<ColorScheme>(this.loadScheme());

  readonly scheme = this._scheme.asReadonly();
  readonly isDark = computed(() => this._scheme() === 'dark');

  constructor() {
    // Reactively apply the scheme to <body> whenever the signal changes
    effect(() => {
      const s = this._scheme();
      document.body.style.colorScheme = s;
      document.body.classList.toggle('dark-theme', s === 'dark');
      localStorage.setItem(STORAGE_KEY, s);
    });
  }

  toggle(): void {
    this._scheme.update((s) => (s === 'light' ? 'dark' : 'light'));
  }

  setScheme(scheme: ColorScheme): void {
    this._scheme.set(scheme);
  }

  private loadScheme(): ColorScheme {
    const stored = localStorage.getItem(STORAGE_KEY) as ColorScheme | null;
    if (stored === 'light' || stored === 'dark') return stored;
    // Default to light mode on first visit
    return 'light';
  }
}
