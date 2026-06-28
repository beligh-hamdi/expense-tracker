import { Service, inject, signal, effect } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { DEFAULT_CATEGORIES } from '@shared/models/category.model';

export type AppLang = 'en' | 'fr' | 'ar';

export const LANGUAGES: { code: AppLang; label: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
];

const STORAGE_KEY = 'et_lang';

@Service()
export class LanguageService {
  private readonly transloco = inject(TranslocoService);

  readonly activeLang = signal<AppLang>(this.loadSaved());
  readonly languages = LANGUAGES;

  constructor() {
    // Apply DOM attributes for the saved language immediately on startup
    this.applyDom(this.activeLang());

    // Persist + apply whenever lang changes
    effect(() => {
      const lang = this.activeLang();
      const prevDir = this.savedDir();
      const nextDir = LANGUAGES.find(l => l.code === lang)!.dir;

      localStorage.setItem(STORAGE_KEY, lang);

      if (prevDir !== nextDir) {
        // Direction change requires a full reload so Angular Material CDK
        // re-reads Directionality from the new dir attribute on boot.
        // Store the new lang first so it's picked up after reload.
        this.applyDom(lang);
        window.location.reload();
        return;
      }

      // Same direction — hot-swap translation only, no reload needed
      this.transloco.setActiveLang(lang);
    });
  }

  setLang(lang: AppLang): void {
    this.activeLang.set(lang);
  }

  /**
   * Translates a category name stored in Google Sheets.
   * Default categories were seeded with English names — this maps them
   * back to the correct translated label for the active language.
   * User-created category names are returned unchanged.
   */
  translateCategoryName(storedName: string): string {
    const key = this.nameToKey(storedName);
    if (!key) return storedName;
    const translated = this.transloco.translate<string>(key);
    return translated && translated !== key ? translated : storedName;
  }

  /**
   * Maps a stored category name back to its i18n key.
   * Only matches against the English fallback names — those are what
   * existing sheets contain. translate() is NOT called here to avoid
   * triggering missing-translation warnings for unloaded lang files.
   */
  private nameToKey(name: string): string | null {
    const lower = name.trim().toLowerCase();
    for (const cat of DEFAULT_CATEGORIES) {
      if (cat.name.toLowerCase() === lower) return cat.nameKey;
    }
    return null;
  }

  /** The writing direction stored for the current page session */
  private savedDir(): 'ltr' | 'rtl' {
    return document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';
  }

  private applyDom(lang: AppLang): void {
    this.transloco.setActiveLang(lang);
    const dir = LANGUAGES.find(l => l.code === lang)?.dir ?? 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.body.dir = dir;
    document.body.classList.toggle('rtl', dir === 'rtl');
  }

  private loadSaved(): AppLang {
    const saved = localStorage.getItem(STORAGE_KEY) as AppLang | null;
    return saved && LANGUAGES.some(l => l.code === saved) ? saved : 'en';
  }
}
