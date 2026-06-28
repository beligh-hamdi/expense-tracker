import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

const GOOGLE_API_URLS = [
  'https://sheets.googleapis.com',
  'https://www.googleapis.com',
];

// Never attach a Bearer token to the token exchange endpoint itself
const EXCLUDED_URLS = ['https://oauth2.googleapis.com/token'];

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  const isExcluded = EXCLUDED_URLS.some((url) => req.url.startsWith(url));
  const isGoogleApi = GOOGLE_API_URLS.some((url) => req.url.startsWith(url));

  if (isExcluded || !isGoogleApi) {
    return next(req);
  }

  const token = auth.getAccessToken();
  if (!token) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });

  return next(authReq);
};
