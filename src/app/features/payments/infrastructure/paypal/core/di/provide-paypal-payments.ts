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
export { PaypalWebhookNormalizer } from '@payments/infrastructure/paypal/workflows/webhook/paypal-webhook.normalizer';

const PAYPAL_FACTORY_PROVIDERS: Provider[] = [
  { provide: PAYMENT_PROVIDER_FACTORIES, useClass: PaypalProviderFactory, multi: true },
];

const PAYPAL_POLICY_PROVIDERS: Provider[] = [
  { provide: PAYMENT_PROVIDER_METHOD_POLICIES, useClass: PaypalProviderMethodPolicy, multi: true },
];

const PAYPAL_REDIRECT_RETURN_PROVIDERS: Provider[] = [
  { provide: REDIRECT_RETURN_NORMALIZERS, useClass: PaypalRedirectReturnNormalizer, multi: true },
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
  ...PAYPAL_REDIRECT_RETURN_PROVIDERS,
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
  ...PAYPAL_REDIRECT_RETURN_PROVIDERS,
];

export function providePaypalPayments(mode: PaymentsProvidersMode): Provider[] {
  if (mode === 'real') {
    return PAYPAL_REAL_PROVIDERS;
  }

  return PAYPAL_FAKE_PROVIDERS;
}
