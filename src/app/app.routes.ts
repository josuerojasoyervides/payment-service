import type { Routes } from '@angular/router';

/**
 * Main application routes.
 *
 * Payment module is loaded lazily when user
 * navigates to /payments/* for better initial performance.
 */
export const routes: Routes = [
  {
    path: 'payments',
    loadChildren: () => import('./features/payments/payments.routes').then((m) => m.PAYMENT_ROUTES),
  },
  {
    path: '',
    redirectTo: 'payments',
    pathMatch: 'full',
  },
];
