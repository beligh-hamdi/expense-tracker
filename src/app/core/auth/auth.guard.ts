import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { SheetConfigService } from '@core/google-sheets/sheet-config.service';

export const authGuard: CanActivateFn = () => {
  const auth        = inject(AuthService);
  const sheetConfig = inject(SheetConfigService);
  const router      = inject(Router);

  // Allow access when signed in with Google OR when using offline/local-file mode
  if (auth.isAuthenticated() || sheetConfig.isLocalMode()) {
    return true;
  }

  return router.createUrlTree(['/']);
};
