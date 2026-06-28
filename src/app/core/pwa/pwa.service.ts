import { Service, inject, signal, effect, ApplicationRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, first, map } from 'rxjs/operators';
import { interval, concat } from 'rxjs';

/** Typed wrapper around the browser's beforeinstallprompt event */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

@Service()
export class PwaService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly appRef = inject(ApplicationRef);

  /** True when the browser has surfaced an install prompt */
  readonly installable = signal(false);

  /** True when a new app version is available */
  readonly updateAvailable = signal(false);

  /** True when the browser reports the device is offline */
  readonly isOffline = signal(!navigator.onLine);

  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  constructor() {
    this.listenForInstallPrompt();
    this.listenForOnlineStatus();
    if (this.swUpdate.isEnabled) {
      this.listenForUpdates();
      this.scheduleUpdateChecks();
    }
  }

  // ── Install ───────────────────────────────────────────────────────────────

  async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!this.deferredPrompt) return 'unavailable';
    await this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.installable.set(false);
    return outcome;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async activateUpdate(): Promise<void> {
    await this.swUpdate.activateUpdate();
    document.location.reload();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private listenForInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.installable.set(true);
    });

    // Hide install button once the app is actually installed
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.installable.set(false);
    });
  }

  private listenForOnlineStatus(): void {
    window.addEventListener('online',  () => this.isOffline.set(false));
    window.addEventListener('offline', () => this.isOffline.set(true));
  }

  private listenForUpdates(): void {
    // toSignal bridges the Observable into the signal world
    const ready$ = this.swUpdate.versionUpdates.pipe(
      filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'),
      map(() => true),
    );
    toSignal(ready$, { initialValue: false });
    // drive the writable signal from an effect so the rest of the app can read it
    effect(() => {
      const sub = ready$.subscribe(() => this.updateAvailable.set(true));
      return () => sub.unsubscribe();
    });
  }

  /**
   * Checks for SW updates every 6 hours once the app is stable.
   * Waiting for stability prevents the SW check from delaying initial render.
   */
  private scheduleUpdateChecks(): void {
    const appIsStable$ = this.appRef.isStable.pipe(first((stable) => stable));
    const every6h$ = interval(6 * 60 * 60 * 1000);
    effect(() => {
      const sub = concat(appIsStable$, every6h$).subscribe(() => this.swUpdate.checkForUpdate());
      return () => sub.unsubscribe();
    });
  }
}
