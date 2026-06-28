import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '@core/auth/auth.service';
import { ThemeService } from '@core/theme/theme.service';

@Component({
  selector: 'app-home',
  imports: [MatButtonModule, MatIconModule, MatChipsModule, TranslocoModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent implements OnInit {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);
  readonly theme          = inject(ThemeService);

  readonly year = new Date().getFullYear();

  readonly features = [
    { icon: 'dashboard',       key: 'dashboard'  },
    { icon: 'receipt_long',    key: 'expenses'   },
    { icon: 'document_scanner',key: 'ocr'        },
    { icon: 'auto_awesome',    key: 'insights'   },
    { icon: 'category',        key: 'categories' },
    { icon: 'table_chart',     key: 'sheets'     },
    { icon: 'language',        key: 'i18n'       },
    { icon: 'install_mobile',  key: 'pwa'        },
  ] as const;

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
    }
  }

  signIn(): void {
    this.auth.login();
  }
}
