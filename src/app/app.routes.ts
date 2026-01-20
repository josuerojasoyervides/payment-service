import { Routes } from '@angular/router';

/**
 * Rutas principales de la aplicación.
 * 
 * El módulo de pagos se carga de forma lazy cuando el usuario
 * navega a /payments/* para mejor performance inicial.
 */
export const routes: Routes = [
    {
        path: 'payments',
        loadChildren: () => import('./features/payments/payments.routes')
            .then(m => m.PAYMENT_ROUTES),
    },
    {
        // Ruta raíz redirige al checkout
        path: '',
        redirectTo: 'payments',
        pathMatch: 'full',
    },
];
