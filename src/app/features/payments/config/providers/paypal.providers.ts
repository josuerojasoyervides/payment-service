import type { Provider } from '@angular/core';
import { I18nKeys } from '@core/i18n';
import { PAYMENT_PROVIDER_FACTORIES } from '@payments/application/api/tokens/payment-provider-factories.token';
import { PAYMENT_PROVIDER_METHOD_POLICIES } from '@payments/application/api/tokens/payment-provider-method-policies.token';
import {
  PAYMENT_PROVIDER_UI_META,
  type PaymentProviderUiMeta,
} from '@payments/application/api/tokens/payment-provider-ui-meta.token';
import type { PaymentsProvidersMode } from '@payments/config/payments-providers.types';
import { fakeIntentFacadeFactory } from '@payments/config/providers/fake-intent-facade.factory';
import { PaypalIntentFacade } from '@payments/infrastructure/paypal/facades/intent.facade';
import { PaypalProviderFactory } from '@payments/infrastructure/paypal/factories/paypal-provider.factory';
import { FakePaypalCancelIntentGateway } from '@payments/infrastructure/paypal/fake-gateways/intent/fake-paypal-cancel-intent.gateway';
import { FakePaypalConfirmIntentGateway } from '@payments/infrastructure/paypal/fake-gateways/intent/fake-paypal-confirm-intent.gateway';
import { FakePaypalCreateIntentGateway } from '@payments/infrastructure/paypal/fake-gateways/intent/fake-paypal-create-intent.gateway';
import { FakePaypalGetIntentGateway } from '@payments/infrastructure/paypal/fake-gateways/intent/fake-paypal-get-intent.gateway';
import { PaypalCancelIntentGateway } from '@payments/infrastructure/paypal/gateways/intent/cancel-intent.gateway';
import { PaypalConfirmIntentGateway } from '@payments/infrastructure/paypal/gateways/intent/confirm-intent.gateway';
import { PaypalCreateIntentGateway } from '@payments/infrastructure/paypal/gateways/intent/create-intent.gateway';
import { PaypalGetIntentGateway } from '@payments/infrastructure/paypal/gateways/intent/get-intent.gateway';
import { PaypalFinalizeHandler } from '@payments/infrastructure/paypal/handlers/paypal-finalize.handler';
import { PaypalProviderMethodPolicy } from '@payments/infrastructure/paypal/policies/paypal-provider-method.policy';

const PAYPAL_FACTORY_PROVIDERS: Provider[] = [
  { provide: PAYMENT_PROVIDER_FACTORIES, useClass: PaypalProviderFactory, multi: true },
];

const PAYPAL_POLICY_PROVIDERS: Provider[] = [
  { provide: PAYMENT_PROVIDER_METHOD_POLICIES, useClass: PaypalProviderMethodPolicy, multi: true },
];

const PAYPAL_UI_META = {
  providerId: 'paypal',
  displayNameKey: I18nKeys.ui.provider_paypal,
  buttonClasses: 'bg-paypal-primary hover:opacity-90 text-white focus:ring-paypal-primary',
} as const satisfies PaymentProviderUiMeta;

const PAYPAL_UI_META_PROVIDERS: Provider[] = [
  { provide: PAYMENT_PROVIDER_UI_META, useValue: PAYPAL_UI_META, multi: true },
];

const PAYPAL_REAL_PROVIDERS: Provider[] = [
  PaypalIntentFacade,
  PaypalCreateIntentGateway,
  PaypalConfirmIntentGateway,
  PaypalCancelIntentGateway,
  PaypalGetIntentGateway,
  PaypalFinalizeHandler,
  ...PAYPAL_FACTORY_PROVIDERS,
  ...PAYPAL_POLICY_PROVIDERS,
  ...PAYPAL_UI_META_PROVIDERS,
];

const PAYPAL_FAKE_PROVIDERS: Provider[] = [
  FakePaypalCreateIntentGateway,
  FakePaypalConfirmIntentGateway,
  FakePaypalCancelIntentGateway,
  FakePaypalGetIntentGateway,
  PaypalFinalizeHandler,
  fakeIntentFacadeFactory(
    'paypal',
    PaypalIntentFacade,
    FakePaypalCreateIntentGateway,
    FakePaypalConfirmIntentGateway,
    FakePaypalCancelIntentGateway,
    FakePaypalGetIntentGateway,
  ),
  ...PAYPAL_FACTORY_PROVIDERS,
  ...PAYPAL_POLICY_PROVIDERS,
  ...PAYPAL_UI_META_PROVIDERS,
];

export function providePaypalProviderConfig(mode: PaymentsProvidersMode): Provider[] {
  if (mode === 'real') {
    return PAYPAL_REAL_PROVIDERS;
  }

  return PAYPAL_FAKE_PROVIDERS;
}
