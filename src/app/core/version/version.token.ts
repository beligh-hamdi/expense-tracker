import { InjectionToken } from '@angular/core';
import { environment } from '@environments/environment';

export const APP_VERSION = new InjectionToken<string>('APP_VERSION', {
  providedIn: 'root',
  factory: () => environment.version,
});
