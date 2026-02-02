import type { Provider } from '@angular/core';
import { StripeProviderFactory } from '@app/features/payments/infrastructure/stripe/core/factories/stripe-provider.factory';
import { StripeProviderMethodPolicy } from '@app/features/payments/infrastructure/stripe/shared/policies/stripe-provider-method.policy';
import { StripeIntentFacade } from '@app/features/payments/infrastructure/stripe/workflows/intent/intent.facade';
import { I18nKeys } from '@core/i18n';
import { PAYMENT_PROVIDER_FACTORIES } from '@payments/application/api/tokens/provider/payment-provider-factories.token';
import { PAYMENT_PROVIDER_METHOD_POLICIES } from '@payments/application/api/tokens/provider/payment-provider-method-policies.token';
import type { PaymentsProvidersMode } from '@payments/config/payments-providers.types';
import { FakeIntentStore } from '@payments/infrastructure/fake/shared/state/fake-intent.store';
import { FakeStripeCancelIntentGateway } from '@payments/infrastructure/stripe/testing/fake-gateways/intent/fake-stripe-cancel-intent.gateway';
import { FakeStripeClientConfirmPort } from '@payments/infrastructure/stripe/testing/fake-gateways/intent/fake-stripe-client-confirm.port';
import { FakeStripeConfirmIntentGateway } from '@payments/infrastructure/stripe/testing/fake-gateways/intent/fake-stripe-confirm-intent.gateway';
import { FakeStripeCreateIntentGateway } from '@payments/infrastructure/stripe/testing/fake-gateways/intent/fake-stripe-create-intent.gateway';
import { FakeStripeGetIntentGateway } from '@payments/infrastructure/stripe/testing/fake-gateways/intent/fake-stripe-get-intent.gateway';
import { FakeStripeProviderFactory } from '@payments/infrastructure/stripe/testing/fake-stripe-provider.factory';
import { StripeCancelIntentGateway } from '@payments/infrastructure/stripe/workflows/intent/gateways/intent/cancel-intent.gateway';
import { StripeConfirmIntentGateway } from '@payments/infrastructure/stripe/workflows/intent/gateways/intent/confirm-intent.gateway';
import { StripeCreateIntentGateway } from '@payments/infrastructure/stripe/workflows/intent/gateways/intent/create-intent.gateway';
import { StripeGetIntentGateway } from '@payments/infrastructure/stripe/workflows/intent/gateways/intent/get-intent.gateway';
import { fakeIntentFacadeFactory } from '@payments/infrastructure/testing/fake-intent-facade.factory';
import { PAYMENT_PROVIDER_DESCRIPTORS } from '@payments/presentation/tokens/provider/payment-provider-descriptors.token';
import {
  PAYMENT_PROVIDER_UI_META,
  type PaymentProviderUiMeta,
} from '@payments/presentation/tokens/provider/payment-provider-ui-meta.token';
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

const STRIPE_DESCRIPTOR = {
  id: 'stripe' as const,
  labelKey: I18nKeys.ui.provider_stripe,
  descriptionKey: I18nKeys.ui.provider_stripe_description,
  icon: '💳',
  supportedMethods: ['card', 'spei'] as const,
};

const STRIPE_UI_META_PROVIDERS: Provider[] = [
  { provide: PAYMENT_PROVIDER_UI_META, useValue: STRIPE_UI_META, multi: true },
];

const STRIPE_DESCRIPTOR_PROVIDERS: Provider[] = [
  { provide: PAYMENT_PROVIDER_DESCRIPTORS, useValue: STRIPE_DESCRIPTOR, multi: true },
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
  ...STRIPE_DESCRIPTOR_PROVIDERS,
];

const STRIPE_FAKE_FACTORY_PROVIDERS: Provider[] = [
  { provide: PAYMENT_PROVIDER_FACTORIES, useClass: FakeStripeProviderFactory, multi: true },
];

const STRIPE_FAKE_PROVIDERS: Provider[] = [
  FakeIntentStore,
  FakeStripeClientConfirmPort,
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
  ...STRIPE_FAKE_FACTORY_PROVIDERS,
  ...STRIPE_POLICY_PROVIDERS,
  ...STRIPE_UI_META_PROVIDERS,
  ...STRIPE_DESCRIPTOR_PROVIDERS,
];

export function provideStripePayments(mode: PaymentsProvidersMode): Provider[] {
  if (mode === 'real') {
    return STRIPE_REAL_PROVIDERS;
  }

  return STRIPE_FAKE_PROVIDERS;
}
