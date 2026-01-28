import { InjectionToken } from '@angular/core';

import type { PaymentStorePort } from '../ports/payment-store.port';

export const PAYMENT_STATE = new InjectionToken<PaymentStorePort>('PaymentState');
