import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  // Home page — shown to unauthenticated visitors; redirects to /dashboard if already signed in
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home').then((m) => m.HomeComponent),
    pathMatch: 'full',
  },

  // OAuth callback — public
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./core/auth/auth-callback').then((m) => m.AuthCallbackComponent),
  },

  // Legacy /login → redirect to home
  { path: 'login', redirectTo: '', pathMatch: 'full' },

  // Protected routes (wrapped in the shell layout)
  {
    path: '',
    loadComponent: () =>
      import('./layout/shell').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardComponent) },
      { path: 'expenses',  loadComponent: () => import('./features/expenses/expenses').then((m) => m.ExpensesComponent) },
      { path: 'categories',loadComponent: () => import('./features/categories/categories').then((m) => m.CategoriesComponent) },
      { path: 'insights',  loadComponent: () => import('./features/insights/insights').then((m) => m.InsightsComponent) },
      { path: 'settings',  loadComponent: () => import('./features/settings/settings').then((m) => m.SettingsComponent) },
    ],
  },

  // Fallback
  { path: '**', redirectTo: '' },
];
