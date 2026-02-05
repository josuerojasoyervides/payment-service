import type { Provider } from '@angular/core';
import { I18nKeys } from '@core/i18n';
import type { ProviderDescriptor } from '@payments/application/api/ports/payment-store.port';
import { PAYMENT_PROVIDER_DESCRIPTORS } from '@payments/application/api/tokens/provider/payment-provider-descriptors.token';
import {
  PAYMENT_PROVIDER_UI_META,
  type PaymentProviderUiMeta,
} from '@payments/application/api/tokens/provider/payment-provider-ui-meta.token';

const STRIPE_UI_META = {
  providerId: 'stripe',
  displayNameKey: I18nKeys.ui.provider_stripe,
  buttonClasses: 'bg-stripe-primary hover:opacity-90 text-white focus:ring-stripe-primary',
} as const satisfies PaymentProviderUiMeta;

const STRIPE_DESCRIPTOR: ProviderDescriptor = {
  id: 'stripe',
  labelKey: I18nKeys.ui.provider_stripe,
  descriptionKey: I18nKeys.ui.provider_stripe_description,
  icon: '💳',
  supportedMethods: ['card', 'spei'],
};

const PAYPAL_UI_META = {
  providerId: 'paypal',
  displayNameKey: I18nKeys.ui.provider_paypal,
  buttonClasses: 'bg-paypal-primary hover:opacity-90 text-white focus:ring-paypal-primary',
} as const satisfies PaymentProviderUiMeta;

const PAYPAL_DESCRIPTOR: ProviderDescriptor = {
  id: 'paypal',
  labelKey: I18nKeys.ui.provider_paypal,
  descriptionKey: I18nKeys.ui.provider_paypal_description,
  icon: '🅿️',
  supportedMethods: ['card', 'spei'],
};

export const PAYMENT_UI_PROVIDERS: Provider[] = [
  { provide: PAYMENT_PROVIDER_UI_META, useValue: STRIPE_UI_META, multi: true },
  { provide: PAYMENT_PROVIDER_UI_META, useValue: PAYPAL_UI_META, multi: true },
  { provide: PAYMENT_PROVIDER_DESCRIPTORS, useValue: STRIPE_DESCRIPTOR, multi: true },
  { provide: PAYMENT_PROVIDER_DESCRIPTORS, useValue: PAYPAL_DESCRIPTOR, multi: true },
];
