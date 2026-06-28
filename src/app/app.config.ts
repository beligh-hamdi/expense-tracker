import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  isDevMode,
  Service,
  inject,
  APP_INITIALIZER,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTransloco, TranslocoLoader } from '@jsverse/transloco';

import { routes } from './app.routes';
import { tokenInterceptor } from '@core/auth/token.interceptor';
import { LocalFileService } from '@core/local-file/local-file.service';
import { SheetConfigService } from '@core/google-sheets/sheet-config.service';

@Service()
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);
  getTranslation(lang: string) {
    return this.http.get<Record<string, unknown>>(`i18n/${lang}.json`);
  }
}

function initLocalFile(localFile: LocalFileService, sheetConfig: SheetConfigService) {
  return () => sheetConfig.isLocalMode() ? localFile.restoreFromIdb() : Promise.resolve();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    {
      provide: APP_INITIALIZER,
      useFactory: (lf: LocalFileService, sc: SheetConfigService) => initLocalFile(lf, sc),
      deps: [LocalFileService, SheetConfigService],
      multi: true,
    },
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([tokenInterceptor])),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideTransloco({
      config: {
        availableLangs: ['en', 'fr', 'ar'],
        defaultLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
  ],
};
