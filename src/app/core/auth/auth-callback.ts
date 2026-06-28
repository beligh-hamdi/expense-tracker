import { Component, inject, signal, effect } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-auth-callback',
  imports: [MatProgressSpinnerModule, MatButtonModule, MatIconModule, TranslocoModule],
  templateUrl: './auth-callback.html',
  styleUrl: './auth-callback.scss',
})
export class AuthCallbackComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly transloco = inject(TranslocoService);

  readonly errorMessage = signal<string | null>(null);

  constructor() {
    effect(async () => {
      const code  = this.route.snapshot.queryParamMap.get('code');
      const error = this.route.snapshot.queryParamMap.get('error');

      // iOS standalone PWA flow: this callback page was opened in a new Safari
      // tab by the PWA. Broadcast the code/error back to the PWA window (which
      // holds the code_verifier) then close this tab.
      if (this.isIOSCallbackTab()) {
        const channel = new BroadcastChannel('oauth_callback');
        channel.postMessage(error ? { error } : { code });
        channel.close();
        // Give the message a moment to deliver, then close this tab.
        setTimeout(() => window.close(), 300);
        return;
      }

      if (error) {
        this.errorMessage.set(`${this.transloco.translate('auth_callback.google_returned_error')} ${error}`);
        return;
      }
      if (!code) {
        this.errorMessage.set(this.transloco.translate('auth_callback.no_auth_code'));
        return;
      }
      try {
        await this.auth.handleCallback(code);
      } catch (err: unknown) {
        this.errorMessage.set(this.extractErrorDetail(err));
      }
    });
  }

  /**
   * Returns true ONLY when this callback tab was opened by an iOS standalone
   * PWA login flow.
   *
   * The standalone PWA sets localStorage key 'et_pwa_oauth' = '1' before
   * calling window.open(). This flag is the authoritative signal — it means:
   *   "A standalone PWA window is alive and waiting on BroadcastChannel.
   *    Broadcast the code back to it instead of handling it here."
   *
   * This avoids false positives on iOS Safari regular browser tabs, which also
   * have navigator.standalone === false but were NOT opened by a standalone PWA.
   */
  private isIOSCallbackTab(): boolean {
    const hasOAuthParam =
      !!this.route.snapshot.queryParamMap.get('code') ||
      !!this.route.snapshot.queryParamMap.get('error');
    const pwaInitiated = localStorage.getItem('et_pwa_oauth') === '1';
    return hasOAuthParam && pwaInitiated;
  }

  retry(): void {
    this.router.navigate(['/login']);
  }

  private extractErrorDetail(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (err && typeof err === 'object') {
      // HttpErrorResponse shape
      const httpErr = err as {
        error?: { error?: string; error_description?: string } | string;
        status?: number;
        message?: string;
      };
      if (httpErr.error && typeof httpErr.error === 'object') {
        const { error, error_description } = httpErr.error;
        if (error_description) return `${error} — ${error_description}`;
        if (error) return error;
      }
      if (typeof httpErr.error === 'string' && httpErr.error) return httpErr.error;
      if (httpErr.status === 0) return 'Cannot reach the token proxy — is the worker running? (wrangler dev)';
      if (httpErr.status) return `Token exchange failed (HTTP ${httpErr.status})`;
      if (httpErr.message) return httpErr.message;
    }
    return this.transloco.translate('auth_callback.unexpected_error');
  }
}
