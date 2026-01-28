import { InjectionToken } from '@angular/core';
import type { I18nKey } from '@core/i18n';
import type { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';

export interface PaymentProviderUiMeta {
  providerId: PaymentProviderId;
  displayNameKey?: I18nKey;
  buttonClasses?: string;
}

export const PAYMENT_PROVIDER_UI_META = new InjectionToken<readonly PaymentProviderUiMeta[]>(
  'PAYMENT_PROVIDER_UI_META',
);
