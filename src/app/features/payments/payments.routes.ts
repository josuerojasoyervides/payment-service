import { Routes } from '@angular/router';

import providePayments from './config/payment.providers';

/**
 * Payments module routes with lazy loading.
 *
 * This file defines child routes for the payments module
 * and configures providers that load only when
 * the user navigates to these routes.
 *
 * Available routes:
 * - /payments/checkout - Main checkout flow
 * - /payments/return - 3DS/PayPal return
 * - /payments/cancel - PayPal cancel
 * - /payments/history - Payment history
 * - /payments/status - Status lookup by ID
 * - /payments/showcase - Component demo
 *
 * Benefits:
 * - Lazy loading: code downloads only when needed
 * - Scoped providers: payment services are not global
 * - Better initial performance: less code in main bundle
 */
export const PAYMENT_ROUTES: Routes = [
  {
    path: '',
    providers: [
      // Load all payment providers when this route is accessed
      ...providePayments(),
    ],
    children: [
      {
        path: '',
        redirectTo: 'checkout',
        pathMatch: 'full',
      },
      {
        path: 'checkout',
        loadComponent: () =>
          import('./ui/pages/checkout/checkout.page').then((m) => m.CheckoutComponent),
        title: 'Checkout - Payment',
      },
      {
        path: 'return',
        loadComponent: () => import('./ui/pages/return/return.page').then((m) => m.ReturnComponent),
        title: 'Payment Completed',
        data: { returnFlow: true },
      },
      {
        path: 'cancel',
        loadComponent: () => import('./ui/pages/return/return.page').then((m) => m.ReturnComponent),
        title: 'Payment Canceled',
        data: { cancelFlow: true },
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./ui/pages/history/history.page').then((m) => m.HistoryComponent),
        title: 'Payment History',
      },
      {
        path: 'status',
        loadComponent: () => import('./ui/pages/status/status.page').then((m) => m.StatusComponent),
        title: 'Check Status',
      },
      {
        path: 'showcase',
        loadComponent: () =>
          import('./ui/pages/showcase/showcase.page').then((m) => m.ShowcaseComponent),
        title: 'Component Showcase',
      },
    ],
  },
];

export default PAYMENT_ROUTES;
