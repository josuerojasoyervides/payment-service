import { Routes } from '@angular/router';

import providePayments from './config/payment.providers';

/**
 * Rutas del módulo de pagos con carga lazy.
 *
 * Este archivo define las rutas hijas del módulo de pagos
 * y configura los providers que se cargan solo cuando
 * el usuario navega a estas rutas.
 *
 * Rutas disponibles:
 * - /payments/checkout - Flujo principal de checkout
 * - /payments/return - Retorno de 3DS/PayPal
 * - /payments/cancel - Cancelación desde PayPal
 * - /payments/history - Historial de pagos
 * - /payments/status - Consulta de estado por ID
 * - /payments/showcase - Demo de componentes
 *
 * Beneficios:
 * - Carga lazy: El código se descarga solo cuando es necesario
 * - Providers scoped: Los servicios de pago no se cargan globalmente
 * - Mejor performance inicial: Menos código en el bundle principal
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
        redirectTo: 'checkout',
        pathMatch: 'full',
      },
      {
        path: 'checkout',
        loadComponent: () =>
          import('./ui/pages/checkout/checkout.page').then((m) => m.CheckoutComponent),
        title: 'Checkout - Pago',
      },
      {
        path: 'return',
        loadComponent: () => import('./ui/pages/return/return.page').then((m) => m.ReturnComponent),
        title: 'Pago Completado',
        data: { returnFlow: true },
      },
      {
        path: 'cancel',
        loadComponent: () => import('./ui/pages/return/return.page').then((m) => m.ReturnComponent),
        title: 'Pago Cancelado',
        data: { cancelFlow: true },
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./ui/pages/history/history.page').then((m) => m.HistoryComponent),
        title: 'Historial de Pagos',
      },
      {
        path: 'status',
        loadComponent: () => import('./ui/pages/status/status.page').then((m) => m.StatusComponent),
        title: 'Consultar Estado',
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
