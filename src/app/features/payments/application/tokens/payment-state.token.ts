import { InjectionToken } from '@angular/core';

import { PaymentStorePort } from '../ports/payment-store.port';

export const PAYMENT_STATE = new InjectionToken<PaymentStorePort>('PaymentState');
