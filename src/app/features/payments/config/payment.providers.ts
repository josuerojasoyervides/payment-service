import { EnvironmentProviders, inject, Provider, ProviderToken, Type } from '@angular/core';
import { PaymentHistoryFacade } from '@payments/application/api/facades/payment-history.facade';
import { PaymentFlowActorService } from '@payments/application/orchestration/flow/payment-flow.actor.service';
import { PaymentFlowFacade } from '@payments/application/orchestration/flow/payment-flow.facade';
import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';
import { FakeCancelIntentGateway } from '@payments/infrastructure/fake/gateways/intent/cancel-intent.gateway';
import { FakeConfirmIntentGateway } from '@payments/infrastructure/fake/gateways/intent/confirm-intent.gateway';
import { FakeCreateIntentGateway } from '@payments/infrastructure/fake/gateways/intent/create-intent.gateway';
import { FakeGetIntentGateway } from '@payments/infrastructure/fake/gateways/intent/get-intent.gateway';
import { FakePaypalCancelIntentGateway } from '@payments/infrastructure/paypal/fake-gateways/intent/fake-paypal-cancel-intent.gateway';
import { FakePaypalConfirmIntentGateway } from '@payments/infrastructure/paypal/fake-gateways/intent/fake-paypal-confirm-intent.gateway';
import { FakePaypalCreateIntentGateway } from '@payments/infrastructure/paypal/fake-gateways/intent/fake-paypal-create-intent.gateway';
import { FakePaypalGetIntentGateway } from '@payments/infrastructure/paypal/fake-gateways/intent/fake-paypal-get-intent.gateway';
import { PaypalCancelIntentGateway } from '@payments/infrastructure/paypal/gateways/intent/cancel-intent.gateway';
import { PaypalConfirmIntentGateway } from '@payments/infrastructure/paypal/gateways/intent/confirm-intent.gateway';
import { PaypalCreateIntentGateway } from '@payments/infrastructure/paypal/gateways/intent/create-intent.gateway';
import { PaypalGetIntentGateway } from '@payments/infrastructure/paypal/gateways/intent/get-intent.gateway';
import { FakeStripeCancelIntentGateway } from '@payments/infrastructure/stripe/fake-gateways/intent/fake-stripe-cancel-intent.gateway';
import { FakeStripeConfirmIntentGateway } from '@payments/infrastructure/stripe/fake-gateways/intent/fake-stripe-confirm-intent.gateway';
import { FakeStripeCreateIntentGateway } from '@payments/infrastructure/stripe/fake-gateways/intent/fake-stripe-create-intent.gateway';
import { FakeStripeGetIntentGateway } from '@payments/infrastructure/stripe/fake-gateways/intent/fake-stripe-get-intent.gateway';

import { ExternalEventAdapter } from '../application/adapters/external-event.adapter';
import { NgRxSignalsStateAdapter } from '../application/adapters/ngrx-signals-state.adapter';
import { CLIENT_CONFIRM_PORTS } from '../application/api/tokens/client-confirm.token';
import { FINALIZE_PORTS } from '../application/api/tokens/finalize.token';
import { PAYMENT_PROVIDER_FACTORIES } from '../application/api/tokens/payment-provider-factories.token';
import { PAYMENT_PROVIDER_METHOD_POLICIES } from '../application/api/tokens/payment-provider-method-policies.token';
import { PAYMENT_STATE } from '../application/api/tokens/payment-state.token';
import { ProviderFactoryRegistry } from '../application/orchestration/registry/provider-factory.registry';
import { ProviderMethodPolicyRegistry } from '../application/orchestration/registry/provider-method-policy.registry';
import { FallbackOrchestratorService } from '../application/orchestration/services/fallback-orchestrator.service';
import { NextActionOrchestratorService } from '../application/orchestration/services/next-action-orchestrator.service';
import { PaymentsStore } from '../application/orchestration/store/payment-store';
import { CancelPaymentUseCase } from '../application/orchestration/use-cases/cancel-payment.use-case';
import { ConfirmPaymentUseCase } from '../application/orchestration/use-cases/confirm-payment.use-case';
import { GetPaymentStatusUseCase } from '../application/orchestration/use-cases/get-payment-status.use-case';
import { StartPaymentUseCase } from '../application/orchestration/use-cases/start-payment.use-case';
import { FakePaymentGateway } from '../infrastructure/fake/gateways/fake-payment.gateway';
import { PaypalIntentFacade } from '../infrastructure/paypal/facades/intent.facade';
import { PaypalProviderFactory } from '../infrastructure/paypal/factories/paypal-provider.factory';
import { PaypalProviderMethodPolicy } from '../infrastructure/paypal/policies/paypal-provider-method.policy';
import { StripeIntentFacade } from '../infrastructure/stripe/facades/intent.facade';
import { StripeProviderFactory } from '../infrastructure/stripe/factories/stripe-provider.factory';
import { StripeCancelIntentGateway } from '../infrastructure/stripe/gateways/intent/cancel-intent.gateway';
import { StripeConfirmIntentGateway } from '../infrastructure/stripe/gateways/intent/confirm-intent.gateway';
import { StripeCreateIntentGateway } from '../infrastructure/stripe/gateways/intent/create-intent.gateway';
import { StripeGetIntentGateway } from '../infrastructure/stripe/gateways/intent/get-intent.gateway';
import { StripeProviderMethodPolicy } from '../infrastructure/stripe/policies/stripe-provider-method.policy';
import { IdempotencyKeyFactory } from '../shared/idempotency/idempotency-key.factory';

export type PaymentsProvidersMode = 'fake' | 'real';

export interface PaymentsProvidersOptions {
  mode?: PaymentsProvidersMode;
  extraProviders?: Provider[];
}

/**
 * Provider bundles by provider implementation
 */

const STRIPE_REAL_GATEWAYS: Provider[] = [
  StripeIntentFacade,
  StripeCreateIntentGateway,
  StripeConfirmIntentGateway,
  StripeCancelIntentGateway,
  StripeGetIntentGateway,
];
const STRIPE_FAKE_GATEWAYS: Provider[] = [
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
];

const PAYPAL_REAL_GATEWAYS: Provider[] = [
  PaypalIntentFacade,
  PaypalCreateIntentGateway,
  PaypalConfirmIntentGateway,
  PaypalCancelIntentGateway,
  PaypalGetIntentGateway,
];
const PAYPAL_FAKE_GATEWAYS: Provider[] = [
  FakePaypalCreateIntentGateway,
  FakePaypalConfirmIntentGateway,
  FakePaypalCancelIntentGateway,
  FakePaypalGetIntentGateway,
  fakeIntentFacadeFactory(
    'paypal',
    PaypalIntentFacade,
    FakePaypalCreateIntentGateway,
    FakePaypalConfirmIntentGateway,
    FakePaypalCancelIntentGateway,
    FakePaypalGetIntentGateway,
  ),
];

function selectGateways(mode: PaymentsProvidersMode): Provider[] {
  if (mode === 'real') {
    return [...STRIPE_REAL_GATEWAYS, ...PAYPAL_REAL_GATEWAYS];
  }
  return [...STRIPE_FAKE_GATEWAYS, ...PAYPAL_FAKE_GATEWAYS];
}

/**
 * Cross-cutting providers (grow-safe lists)
 */

const FACTORY_PROVIDERS: Provider[] = [
  { provide: PAYMENT_PROVIDER_FACTORIES, useClass: StripeProviderFactory, multi: true },
  { provide: PAYMENT_PROVIDER_FACTORIES, useClass: PaypalProviderFactory, multi: true },
];

const POLICY_PROVIDERS: Provider[] = [
  { provide: PAYMENT_PROVIDER_METHOD_POLICIES, useClass: StripeProviderMethodPolicy, multi: true },
  { provide: PAYMENT_PROVIDER_METHOD_POLICIES, useClass: PaypalProviderMethodPolicy, multi: true },
];

const USE_CASE_PROVIDERS: Provider[] = [
  StartPaymentUseCase,
  ConfirmPaymentUseCase,
  CancelPaymentUseCase,
  GetPaymentStatusUseCase,
];

const ACTION_PORT_PROVIDERS: Provider[] = [
  { provide: CLIENT_CONFIRM_PORTS, useValue: [] },
  { provide: FINALIZE_PORTS, useValue: [] },
];

const APPLICATION_PROVIDERS: Provider[] = [
  ProviderFactoryRegistry,
  ProviderMethodPolicyRegistry,
  ExternalEventAdapter,
  FallbackOrchestratorService,
  NextActionOrchestratorService,
  PaymentsStore,
  PaymentFlowActorService,
  PaymentFlowFacade,
  PaymentHistoryFacade,
  { provide: PAYMENT_STATE, useClass: NgRxSignalsStateAdapter },
];

const SHARED_PROVIDERS: Provider[] = [IdempotencyKeyFactory];

function buildPaymentsProviders(options: PaymentsProvidersOptions = {}): Provider[] {
  const mode = options.mode ?? 'fake';

  return [
    ...selectGateways(mode),
    ...FACTORY_PROVIDERS,
    ...POLICY_PROVIDERS,
    ...USE_CASE_PROVIDERS,
    ...ACTION_PORT_PROVIDERS,
    ...APPLICATION_PROVIDERS,
    ...SHARED_PROVIDERS,
    ...(options.extraProviders ?? []),
  ];
}

/**
 * Default export: convenience for app.config.ts
 */
export default function providePayments(): (Provider | EnvironmentProviders)[] {
  return buildPaymentsProviders();
}

/**
 * Backwards-compatible config function
 */
export function providePaymentsWithConfig(options: {
  useRealGateways?: boolean;
  extraProviders?: Provider[];
}): (Provider | EnvironmentProviders)[] {
  return buildPaymentsProviders({
    mode: options.useRealGateways ? 'real' : 'fake',
    extraProviders: options.extraProviders,
  });
}

function fakeIntentFacadeFactory<TFacade>(
  providerId: PaymentProviderId,
  facadeToken: ProviderToken<TFacade>,
  createToken: Type<FakeCreateIntentGateway>,
  confirmToken: Type<FakeConfirmIntentGateway>,
  cancelToken: Type<FakeCancelIntentGateway>,
  getToken: Type<FakeGetIntentGateway>,
): Provider {
  return {
    provide: facadeToken,
    useFactory: () =>
      new FakePaymentGateway(
        providerId,
        inject(createToken),
        inject(confirmToken),
        inject(cancelToken),
        inject(getToken),
      ),
  };
}
