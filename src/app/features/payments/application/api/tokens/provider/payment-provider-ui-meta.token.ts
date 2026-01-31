import { InjectionToken } from '@angular/core';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';

export interface PaymentProviderUiMeta {
  providerId: PaymentProviderId;
  /** i18n key (techless string). */
  displayNameKey?: string;
  buttonClasses?: string;
}

export const PAYMENT_PROVIDER_UI_META = new InjectionToken<readonly PaymentProviderUiMeta[]>(
  'PAYMENT_PROVIDER_UI_META',
);
