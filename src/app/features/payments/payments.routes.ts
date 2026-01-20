import { Routes } from '@angular/router';
import providePayments from './config/payment.providers';

/**
 * Rutas del módulo de pagos con carga lazy.
 * 
 * Este archivo define las rutas hijas del módulo de pagos
 * y configura los providers que se cargan solo cuando
 * el usuario navega a estas rutas.
 * 
 * Beneficios:
 * - Carga lazy: El código se descarga solo cuando es necesario
 * - Providers scoped: Los servicios de pago no se cargan globalmente
 * - Mejor performance inicial: Menos código en el bundle principal
 * 
 * @example
 * ```typescript
 * // En app.routes.ts
 * {
 *   path: 'payments',
 *   loadChildren: () => import('./features/payments/payments.routes')
 *     .then(m => m.PAYMENT_ROUTES)
 * }
 * ```
 */
export const PAYMENT_ROUTES: Routes = [
    {
        path: '',
        providers: [
            // Cargar todos los providers de pagos cuando se accede a esta ruta
            ...providePayments(),
        ],
        children: [
            {
                path: '',
                loadComponent: () => import('./ui/pages/checkout/checkout.component')
                    .then(m => m.CheckoutComponent),
                title: 'Checkout - Pago',
            },
            {
                path: 'status',
                loadComponent: () => import('./ui/pages/payments/payments.component')
                    .then(m => m.PaymentsComponent),
                title: 'Estado del Pago',
            },
            {
                path: 'return',
                loadComponent: () => import('./ui/pages/payments/payments.component')
                    .then(m => m.PaymentsComponent),
                title: 'Pago Completado',
                data: { returnFlow: true },
            },
            {
                path: 'cancel',
                loadComponent: () => import('./ui/pages/payments/payments.component')
                    .then(m => m.PaymentsComponent),
                title: 'Pago Cancelado',
                data: { cancelFlow: true },
            },
        ],
    },
];

export default PAYMENT_ROUTES;
