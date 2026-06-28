import { Component, inject, signal, effect } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith, switchMap } from 'rxjs/operators';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { SheetConfigService } from '@core/google-sheets/sheet-config.service';
import { GoogleSheetsService } from '@core/google-sheets/google-sheets.service';
import { PwaService } from '@core/pwa/pwa.service';
import { ThemeService } from '@core/theme/theme.service';
import { LanguageService } from '@core/i18n/language.service';

const SHEET_KEY_AI = 'gemini_api_key';

interface NavItem {
  navKey: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-shell',
  imports: [
    UpperCasePipe,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatMenuModule,
    MatDividerModule,
    TranslocoModule,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class ShellComponent {
  private readonly auth        = inject(AuthService);
  readonly sheetConfig         = inject(SheetConfigService);
  private readonly sheets      = inject(GoogleSheetsService);
  readonly pwa                 = inject(PwaService);
  readonly theme = inject(ThemeService);
  readonly langService = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  readonly installDismissed = signal(false);
  private readonly breakpoints = inject(BreakpointObserver);

  constructor() {
    // Sync AI key from sheet on login when it is not cached locally.
    // Lives here (ShellComponent) to avoid a circular dependency:
    // SheetConfigService → GoogleSheetsService → SheetConfigService.
    effect(() => {
      const isLoggedIn   = !!this.auth.user();
      const isConfigured = this.sheetConfig.isConfigured();
      const hasKey       = this.sheetConfig.hasAiKey();

      if (isLoggedIn && isConfigured && !hasKey) {
        this.sheets.getSetting(SHEET_KEY_AI).then(key => {
          if (key) this.sheetConfig.setAiApiKey(key);
        }).catch(() => { /* non-fatal */ });
      }
    });
  }

  readonly user = this.auth.user;

  // Emits the route segment on every navigation
  private readonly routeSegment$ = this.router.events.pipe(
    filter((e) => e instanceof NavigationEnd),
    map((e) => (e as NavigationEnd).urlAfterRedirects.split('/')[1] || 'dashboard'),
    startWith(this.router.url.split('/')[1] || 'dashboard'),
  );

  // Waits for the translation file to load before emitting — no missing-key warnings
  readonly pageTitle = toSignal(
    this.routeSegment$.pipe(
      switchMap((segment) =>
        this.transloco.selectTranslate(`nav.${segment}`).pipe(
          map((t) => t || segment),
        )
      ),
    ),
    { initialValue: this.router.url.split('/')[1] || 'dashboard' },
  );

  readonly isMobile = toSignal(
    this.breakpoints
      .observe([Breakpoints.XSmall, Breakpoints.Small])
      .pipe(map((r) => r.matches)),
    { initialValue: false }
  );

  readonly navItems: NavItem[] = [
    { navKey: 'dashboard', icon: 'dashboard', route: '/dashboard' },
    { navKey: 'expenses', icon: 'receipt_long', route: '/expenses' },
    { navKey: 'categories', icon: 'category', route: '/categories' },
    { navKey: 'insights', icon: 'auto_awesome', route: '/insights' },
    { navKey: 'settings', icon: 'settings', route: '/settings' },
  ];

  logout(): void {
    this.auth.logout();
  }
}
