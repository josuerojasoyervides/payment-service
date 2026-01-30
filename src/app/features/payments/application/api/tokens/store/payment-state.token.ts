/**
 * Token for the UI-facing payment state. UI injects this to get PaymentStorePort.
 *
 * Wiring: config layer (e.g. payment.providers) binds PAYMENT_STATE to the adapter.
 * UI uses only this token + port; no direct store/selector imports.
 */
import { InjectionToken } from '@angular/core';
import type { PaymentStorePort } from '@payments/application/api/ports/payment-store.port';

export const PAYMENT_STATE = new InjectionToken<PaymentStorePort>('PaymentState');
