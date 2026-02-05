import type { Provider } from '@angular/core';
import { PaypalProviderFactory } from '@app/features/payments/infrastructure/paypal/core/factories/paypal-provider.factory';
import { PaypalProviderMethodPolicy } from '@app/features/payments/infrastructure/paypal/shared/policies/paypal-provider-method.policy';
import { PaypalCancelIntentGateway } from '@app/features/payments/infrastructure/paypal/workflows/order/gateways/cancel-intent.gateway';
import { PaypalConfirmIntentGateway } from '@app/features/payments/infrastructure/paypal/workflows/order/gateways/confirm-intent.gateway';
import { PaypalGetIntentGateway } from '@app/features/payments/infrastructure/paypal/workflows/order/gateways/get-intent.gateway';
import { PaypalIntentFacade } from '@app/features/payments/infrastructure/paypal/workflows/order/order.facade';
import { PAYMENT_PROVIDER_FACTORIES } from '@payments/application/api/tokens/provider/payment-provider-factories.token';
import { PAYMENT_PROVIDER_METHOD_POLICIES } from '@payments/application/api/tokens/provider/payment-provider-method-policies.token';
import { REDIRECT_RETURN_NORMALIZERS } from '@payments/application/api/tokens/redirect/redirect-return-normalizers.token';
import type { PaymentsProvidersMode } from '@payments/config/payments-providers.types';
import { FakePaypalCancelIntentGateway } from '@payments/infrastructure/paypal/testing/fake-gateways/intent/fake-paypal-cancel-intent.gateway';
import { FakePaypalConfirmIntentGateway } from '@payments/infrastructure/paypal/testing/fake-gateways/intent/fake-paypal-confirm-intent.gateway';
import { FakePaypalCreateIntentGateway } from '@payments/infrastructure/paypal/testing/fake-gateways/intent/fake-paypal-create-intent.gateway';
import { FakePaypalGetIntentGateway } from '@payments/infrastructure/paypal/testing/fake-gateways/intent/fake-paypal-get-intent.gateway';
import { PaypalCreateIntentGateway } from '@payments/infrastructure/paypal/workflows/order/gateways/create-intent.gateway';
import { PaypalFinalizeHandler } from '@payments/infrastructure/paypal/workflows/redirect/handlers/paypal-finalize.handler';
import { PaypalRedirectReturnNormalizer } from '@payments/infrastructure/paypal/workflows/redirect/paypal-redirect-return.normalizer';
import { fakeIntentFacadeFactory } from '@payments/infrastructure/testing/fake-intent-facade.factory';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
export { PaypalWebhookNormalizer } from '@payments/infrastructure/paypal/workflows/webhook/paypal-webhook.normalizer';

const paypalFactoryProviders: Provider[] = [
  { provide: PAYMENT_PROVIDER_FACTORIES, useClass: PaypalProviderFactory, multi: true },
];

const paypalPolicyProviders: Provider[] = [
  { provide: PAYMENT_PROVIDER_METHOD_POLICIES, useClass: PaypalProviderMethodPolicy, multi: true },
];

const paypalRedirectReturnProviders: Provider[] = [
  { provide: REDIRECT_RETURN_NORMALIZERS, useClass: PaypalRedirectReturnNormalizer, multi: true },
];

const paypalRealProviders: Provider[] = [
  PaypalIntentFacade,
  PaypalCreateIntentGateway,
  PaypalConfirmIntentGateway,
  PaypalCancelIntentGateway,
  PaypalGetIntentGateway,
  PaypalFinalizeHandler,
  ...paypalFactoryProviders,
  ...paypalPolicyProviders,
  ...paypalRedirectReturnProviders,
];

const paypalFakeProviders: Provider[] = [
  FakePaypalCreateIntentGateway,
  FakePaypalConfirmIntentGateway,
  FakePaypalCancelIntentGateway,
  FakePaypalGetIntentGateway,
  PaypalFinalizeHandler,
  fakeIntentFacadeFactory(
    PAYMENT_PROVIDER_IDS.paypal,
    PaypalIntentFacade,
    FakePaypalCreateIntentGateway,
    FakePaypalConfirmIntentGateway,
    FakePaypalCancelIntentGateway,
    FakePaypalGetIntentGateway,
  ),
  ...paypalFactoryProviders,
  ...paypalPolicyProviders,
  ...paypalRedirectReturnProviders,
];

export function providePaypalPayments(mode: PaymentsProvidersMode): Provider[] {
  if (mode === 'real') {
    return paypalRealProviders;
  }

  return paypalFakeProviders;
}
