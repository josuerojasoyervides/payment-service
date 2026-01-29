import { InjectionToken } from '@angular/core';
import type { PaymentStorePort } from '@payments/application/api/ports/payment-store.port';

export const PAYMENT_STATE = new InjectionToken<PaymentStorePort>('PaymentState');
