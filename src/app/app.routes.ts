import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: 'payments',
        loadComponent: () => import('./features/payments/ui/pages/payments/payments.component').then(m => m.PaymentsComponent)
    },
    {
        path: '',
        loadComponent: () => import('./features/payments/ui/pages/checkout/checkout.component').then(m => m.CheckoutComponent)
    },
];
