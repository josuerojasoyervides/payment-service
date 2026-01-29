import type { Provider } from '@angular/core';
import { I18nKeys } from '@core/i18n';
import { PAYMENT_PROVIDER_FACTORIES } from '@payments/application/api/tokens/provider/payment-provider-factories.token';
import { PAYMENT_PROVIDER_METHOD_POLICIES } from '@payments/application/api/tokens/provider/payment-provider-method-policies.token';
import {
  PAYMENT_PROVIDER_UI_META,
  type PaymentProviderUiMeta,
} from '@payments/application/api/tokens/provider/payment-provider-ui-meta.token';
import type { PaymentsProvidersMode } from '@payments/config/payments-providers.types';
import { StripeProviderFactory } from '@payments/infrastructure/stripe/factories/stripe-provider.factory';
import { StripeProviderMethodPolicy } from '@payments/infrastructure/stripe/policies/stripe-provider-method.policy';
import { FakeStripeCancelIntentGateway } from '@payments/infrastructure/stripe/testing/fake-gateways/intent/fake-stripe-cancel-intent.gateway';
import { FakeStripeConfirmIntentGateway } from '@payments/infrastructure/stripe/testing/fake-gateways/intent/fake-stripe-confirm-intent.gateway';
import { FakeStripeCreateIntentGateway } from '@payments/infrastructure/stripe/testing/fake-gateways/intent/fake-stripe-create-intent.gateway';
import { FakeStripeGetIntentGateway } from '@payments/infrastructure/stripe/testing/fake-gateways/intent/fake-stripe-get-intent.gateway';
import { StripeIntentFacade } from '@payments/infrastructure/stripe/workflows/intent/facades/intent.facade';
import { StripeCancelIntentGateway } from '@payments/infrastructure/stripe/workflows/intent/gateways/intent/cancel-intent.gateway';
import { StripeConfirmIntentGateway } from '@payments/infrastructure/stripe/workflows/intent/gateways/intent/confirm-intent.gateway';
import { StripeCreateIntentGateway } from '@payments/infrastructure/stripe/workflows/intent/gateways/intent/create-intent.gateway';
import { StripeGetIntentGateway } from '@payments/infrastructure/stripe/workflows/intent/gateways/intent/get-intent.gateway';
import { fakeIntentFacadeFactory } from '@payments/infrastructure/testing/fake-intent-facade.factory';
export { StripeWebhookNormalizer } from '@payments/infrastructure/stripe/workflows/webhook/stripe-webhook.normalizer';

const STRIPE_FACTORY_PROVIDERS: Provider[] = [
  { provide: PAYMENT_PROVIDER_FACTORIES, useClass: StripeProviderFactory, multi: true },
];

const STRIPE_POLICY_PROVIDERS: Provider[] = [
  { provide: PAYMENT_PROVIDER_METHOD_POLICIES, useClass: StripeProviderMethodPolicy, multi: true },
];

const STRIPE_UI_META = {
  providerId: 'stripe',
  displayNameKey: I18nKeys.ui.provider_stripe,
  buttonClasses: 'bg-stripe-primary hover:opacity-90 text-white focus:ring-stripe-primary',
} as const satisfies PaymentProviderUiMeta;

const STRIPE_UI_META_PROVIDERS: Provider[] = [
  { provide: PAYMENT_PROVIDER_UI_META, useValue: STRIPE_UI_META, multi: true },
];

const STRIPE_REAL_PROVIDERS: Provider[] = [
  StripeIntentFacade,
  StripeCreateIntentGateway,
  StripeConfirmIntentGateway,
  StripeCancelIntentGateway,
  StripeGetIntentGateway,
  ...STRIPE_FACTORY_PROVIDERS,
  ...STRIPE_POLICY_PROVIDERS,
  ...STRIPE_UI_META_PROVIDERS,
];

const STRIPE_FAKE_PROVIDERS: Provider[] = [
  FakeStripeCreateIntentGateway,
  FakeStripeConfirmIntentGateway,
  FakeStripeCancelIntentGateway,
  FakeStripeGetIntentGateway,
  fakeIntentFacadeFactory(
    'stripe',
    StripeIntentFacade,
    FakeStripeCreateIntentGateway,
    FakeStripeConfirmIntentGateway,
    FakeStripeCancelIntentGateway,
    FakeStripeGetIntentGateway,
  ),
  ...STRIPE_FACTORY_PROVIDERS,
  ...STRIPE_POLICY_PROVIDERS,
  ...STRIPE_UI_META_PROVIDERS,
];

export function provideStripePayments(mode: PaymentsProvidersMode): Provider[] {
  if (mode === 'real') {
    return STRIPE_REAL_PROVIDERS;
  }

  return STRIPE_FAKE_PROVIDERS;
}
