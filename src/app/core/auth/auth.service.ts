import { Service, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@environments/environment';

export interface GoogleUser {
  sub: string;
  name: string;
  email: string;
  picture: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

const STORAGE_KEYS = {
  accessToken:  'et_access_token',
  expiresAt:    'et_expires_at',
  user:         'et_user',
  // Stored in localStorage so it survives the full-page redirect to Google
  // and back. Deleted immediately after use.
  codeVerifier: 'et_code_verifier',
  // Set to '1' only when login() is called from iOS standalone mode.
  // The callback page reads this flag to decide whether to use the
  // BroadcastChannel path or the normal handleCallback() path.
  // Deleted immediately after use.
  pwaOAuth:     'et_pwa_oauth',
} as const;

@Service()
export class AuthService {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  private readonly _user = signal<GoogleUser | null>(this.loadUser());
  private readonly _accessToken = signal<string | null>(this.loadToken());

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(
    () => !!this._accessToken() && !this.isTokenExpired()
  );

  // ── PKCE helpers ──────────────────────────────────────────────────────────

  private generateRandomString(length = 64): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => chars[b % chars.length]).join('');
  }

  private async sha256(plain: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return crypto.subtle.digest('SHA-256', data);
  }

  private base64URLEncode(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const hashed = await this.sha256(verifier);
    return this.base64URLEncode(hashed);
  }

  // ── iOS standalone detection ──────────────────────────────────────────────

  /**
   * Returns true when running as an installed PWA on iOS (standalone mode).
   *
   * On iOS, standalone PWAs have an isolated localStorage that is NOT shared
   * with Safari tabs. If we redirect the current window to Google for OAuth,
   * the callback URL opens in a new Safari tab with a different localStorage,
   * so the code_verifier stored before the redirect is not visible there.
   *
   * Fix: open the OAuth URL in a new tab instead, keep the PWA window alive
   * (it still holds the code_verifier), and receive the auth code back via
   * BroadcastChannel once the callback tab has the code.
   */
  private get isIOSStandalone(): boolean {
    return (
      'standalone' in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  }

  // ── Login / Logout ────────────────────────────────────────────────────────

  async login(): Promise<void> {
    const verifier = this.generateRandomString();
    const challenge = await this.generateCodeChallenge(verifier);

    localStorage.setItem(STORAGE_KEYS.codeVerifier, verifier);

    const params = new HttpParams({
      fromObject: {
        response_type: 'code',
        client_id: environment.google.clientId,
        redirect_uri: environment.google.redirectUri,
        scope: environment.google.scopes,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        access_type: 'online',
        prompt: 'consent',
      },
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    if (this.isIOSStandalone) {
      // On iOS standalone PWA: open OAuth in a new Safari tab so the PWA
      // window stays alive (and keeps code_verifier in its localStorage).
      // Mark this as a PWA-initiated flow so the callback tab knows to use
      // BroadcastChannel instead of handling the code itself.
      localStorage.setItem(STORAGE_KEYS.pwaOAuth, '1');
      this.listenForCallbackCode();
      window.open(authUrl, '_blank');
    } else {
      // Normal flow: redirect the current tab to Google and back.
      window.location.href = authUrl;
    }
  }

  /**
   * Called only on iOS standalone. Listens on a BroadcastChannel for the
   * auth code sent by the callback page running in the Safari tab.
   */
  private listenForCallbackCode(): void {
    const channel = new BroadcastChannel('oauth_callback');
    channel.onmessage = async (event: MessageEvent<{ code?: string; error?: string }>) => {
      channel.close();
      if (event.data.error || !event.data.code) {
        this.router.navigate(['/login']);
        return;
      }
      try {
        await this.handleCallback(event.data.code);
      } catch {
        this.router.navigate(['/login']);
      }
    };
  }

  /**
   * Exchanges the authorization code for tokens.
   *
   * Production: POSTs to the Cloudflare Worker token proxy which appends
   * client_secret server-side. The secret is never in this bundle.
   *
   * Local dev fallback: if environment.google.clientSecret is set (local
   * environment.ts only, never in the prod build), calls Google's token
   * endpoint directly so wrangler dev doesn't need to be running.
   */
  async handleCallback(code: string): Promise<void> {
    const verifier = localStorage.getItem(STORAGE_KEYS.codeVerifier);
    if (!verifier) {
      throw new Error('Missing PKCE code verifier. Please try signing in again.');
    }

    const devSecret = (environment.google as { clientSecret?: string }).clientSecret;
    const useDirectGoogle = !environment.production && !!devSecret && !devSecret.startsWith('YOUR_');

    const response = await firstValueFrom(
      useDirectGoogle
        ? this.http.post<TokenResponse>(
            'https://oauth2.googleapis.com/token',
            new HttpParams({
              fromObject: {
                code,
                client_id:     environment.google.clientId,
                client_secret: devSecret!,
                redirect_uri:  environment.google.redirectUri,
                grant_type:    'authorization_code',
                code_verifier: verifier,
              },
            }).toString(),
            { headers: new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }) }
          )
        : this.http.post<TokenResponse>(
            environment.google.tokenProxyUrl,
            {
              code,
              code_verifier: verifier,
              redirect_uri:  environment.google.redirectUri,
            },
            { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
          )
    );

    this.storeToken(response);
    localStorage.removeItem(STORAGE_KEYS.codeVerifier);
    localStorage.removeItem(STORAGE_KEYS.pwaOAuth);

    await this.fetchUserInfo(response.access_token);
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEYS.accessToken);
    localStorage.removeItem(STORAGE_KEYS.expiresAt);
    localStorage.removeItem(STORAGE_KEYS.user);
    localStorage.removeItem(STORAGE_KEYS.codeVerifier);
    localStorage.removeItem(STORAGE_KEYS.pwaOAuth);
    this._user.set(null);
    this._accessToken.set(null);
    this.router.navigate(['/login']);
  }

  getAccessToken(): string | null {
    if (this.isTokenExpired()) {
      this.logout();
      return null;
    }
    return this._accessToken();
  }

  // ── Token storage ─────────────────────────────────────────────────────────

  private storeToken(response: TokenResponse): void {
    const expiresAt = Date.now() + response.expires_in * 1000;
    localStorage.setItem(STORAGE_KEYS.accessToken, response.access_token);
    localStorage.setItem(STORAGE_KEYS.expiresAt, String(expiresAt));
    this._accessToken.set(response.access_token);
  }

  private loadToken(): string | null {
    if (this.isTokenExpired()) return null;
    return localStorage.getItem(STORAGE_KEYS.accessToken);
  }

  private isTokenExpired(): boolean {
    const expiresAt = localStorage.getItem(STORAGE_KEYS.expiresAt);
    if (!expiresAt) return true;
    return Date.now() > Number(expiresAt);
  }

  // ── User info ─────────────────────────────────────────────────────────────

  private async fetchUserInfo(accessToken: string): Promise<void> {
    const user = await firstValueFrom(
      this.http.get<GoogleUser>('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    );

    if (user) {
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
      this._user.set(user);
    }
  }

  private loadUser(): GoogleUser | null {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    return raw ? (JSON.parse(raw) as GoogleUser) : null;
  }
}
