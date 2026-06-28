import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  // Public routes
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login').then((m) => m.LoginComponent),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./core/auth/auth-callback').then(
        (m) => m.AuthCallbackComponent
      ),
  },

  // Protected routes (wrapped in the shell layout)
  {
    path: '',
    loadComponent: () =>
      import('./layout/shell').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'expenses',
        loadComponent: () =>
          import('./features/expenses/expenses').then(
            (m) => m.ExpensesComponent
          ),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./features/categories/categories').then(
            (m) => m.CategoriesComponent
          ),
      },
      {
        path: 'insights',
        loadComponent: () =>
          import('./features/insights/insights').then(
            (m) => m.InsightsComponent
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings').then(
            (m) => m.SettingsComponent
          ),
      },
    ],
  },

  // Fallback
  { path: '**', redirectTo: 'login' },
];
