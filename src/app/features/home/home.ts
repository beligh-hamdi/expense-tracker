import { Component, inject, OnInit } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { ThemeService } from '@core/theme/theme.service';
import { LanguageService } from '@core/i18n/language.service';
import { SheetConfigService } from '@core/google-sheets/sheet-config.service';

@Component({
  selector: 'app-home',
  imports: [
    UpperCasePipe,
    MatButtonModule, MatIconModule, MatChipsModule,
    MatMenuModule, MatTooltipModule, MatDividerModule,
    TranslocoModule,
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent implements OnInit {
  private readonly auth        = inject(AuthService);
  private readonly router      = inject(Router);
  private readonly sheetConfig = inject(SheetConfigService);
  readonly theme               = inject(ThemeService);
  readonly lang                = inject(LanguageService);

  readonly year = new Date().getFullYear();

  readonly googleFeatures = [
    { icon: 'dashboard',        key: 'dashboard'  },
    { icon: 'receipt_long',     key: 'expenses'   },
    { icon: 'document_scanner', key: 'ocr'        },
    { icon: 'auto_awesome',     key: 'insights'   },
    { icon: 'category',         key: 'categories' },
    { icon: 'table_chart',      key: 'sheets'     },
    { icon: 'language',         key: 'i18n'       },
    { icon: 'install_mobile',   key: 'pwa'        },
  ] as const;

  readonly offlineFeatures = [
    { icon: 'wifi_off',         key: 'offline_mode' },
    { icon: 'upload_file',      key: 'file_upload'  },
    { icon: 'download',         key: 'export'       },
    { icon: 'sync',             key: 'migrate'      },
  ] as const;

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
    }
  }

  signIn(): void {
    this.auth.login();
  }

  useOffline(): void {
    this.sheetConfig.setDataMode('local');
    this.router.navigate(['/settings'], { replaceUrl: true });
  }
}
