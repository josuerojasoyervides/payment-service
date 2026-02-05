import type { Provider } from '@angular/core';
import { StripeProviderFactory } from '@app/features/payments/infrastructure/stripe/core/factories/stripe-provider.factory';
import { StripeProviderMethodPolicy } from '@app/features/payments/infrastructure/stripe/shared/policies/stripe-provider-method.policy';
import { StripeIntentFacade } from '@app/features/payments/infrastructure/stripe/workflows/intent/intent.facade';
import { PAYMENT_PROVIDER_FACTORIES } from '@payments/application/api/tokens/provider/payment-provider-factories.token';
import { PAYMENT_PROVIDER_METHOD_POLICIES } from '@payments/application/api/tokens/provider/payment-provider-method-policies.token';
import { REDIRECT_RETURN_NORMALIZERS } from '@payments/application/api/tokens/redirect/redirect-return-normalizers.token';
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
import { StripeRedirectReturnNormalizer } from '@payments/infrastructure/stripe/workflows/redirect/stripe-redirect-return.normalizer';
import { fakeIntentFacadeFactory } from '@payments/infrastructure/testing/fake-intent-facade.factory';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
export { StripeWebhookNormalizer } from '@payments/infrastructure/stripe/workflows/webhook/stripe-webhook.normalizer';

const stripeFactoryProviders: Provider[] = [
  { provide: PAYMENT_PROVIDER_FACTORIES, useClass: StripeProviderFactory, multi: true },
];

const stripePolicyProviders: Provider[] = [
  { provide: PAYMENT_PROVIDER_METHOD_POLICIES, useClass: StripeProviderMethodPolicy, multi: true },
];

const stripeRedirectReturnProviders: Provider[] = [
  { provide: REDIRECT_RETURN_NORMALIZERS, useClass: StripeRedirectReturnNormalizer, multi: true },
];

const stripeRealProviders: Provider[] = [
  StripeIntentFacade,
  StripeCreateIntentGateway,
  StripeConfirmIntentGateway,
  StripeCancelIntentGateway,
  StripeGetIntentGateway,
  ...stripeFactoryProviders,
  ...stripePolicyProviders,
  ...stripeRedirectReturnProviders,
];

const stripeFakeFactoryProviders: Provider[] = [
  { provide: PAYMENT_PROVIDER_FACTORIES, useClass: FakeStripeProviderFactory, multi: true },
];

const stripeFakeProviders: Provider[] = [
  FakeIntentStore,
  FakeStripeClientConfirmPort,
  FakeStripeCreateIntentGateway,
  FakeStripeConfirmIntentGateway,
  FakeStripeCancelIntentGateway,
  FakeStripeGetIntentGateway,
  fakeIntentFacadeFactory(
    PAYMENT_PROVIDER_IDS.stripe,
    StripeIntentFacade,
    FakeStripeCreateIntentGateway,
    FakeStripeConfirmIntentGateway,
    FakeStripeCancelIntentGateway,
    FakeStripeGetIntentGateway,
  ),
  ...stripeFakeFactoryProviders,
  ...stripePolicyProviders,
  ...stripeRedirectReturnProviders,
];

export function provideStripePayments(mode: PaymentsProvidersMode): Provider[] {
  if (mode === 'real') {
    return stripeRealProviders;
  }

  return stripeFakeProviders;
}
