import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./features/payments/ui/pages/payments/payments.component').then(m => m.PaymentsComponent)
    },
];
