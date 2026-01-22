import { EnvironmentProviders, Provider } from '@angular/core';

import { NgRxSignalsStateAdapter } from '../application/adapters/ngrx-signals-state.adapter';
import { ProviderFactoryRegistry } from '../application/registry/provider-factory.registry';
import { FallbackOrchestratorService } from '../application/services/fallback-orchestrator.service';
import { PaymentsStore } from '../application/store/payment.store';
import { PAYMENT_PROVIDER_FACTORIES } from '../application/tokens/payment-provider-factories.token';
import { PAYMENT_STATE } from '../application/tokens/payment-state.token';
import { CancelPaymentUseCase } from '../application/use-cases/cancel-payment.use-case';
import { ConfirmPaymentUseCase } from '../application/use-cases/confirm-payment.use-case';
import { GetPaymentStatusUseCase } from '../application/use-cases/get-payment-status.use-case';
import { StartPaymentUseCase } from '../application/use-cases/start-payment.use-case';
import { FakePaymentGateway } from '../infrastructure/fake/gateways/fake-payment.gateway';
import { PaypalProviderFactory } from '../infrastructure/paypal/factories/paypal-provider.factory';
import { PaypalPaymentGateway } from '../infrastructure/paypal/gateways/paypal-payment.gateway';
import { StripeProviderFactory } from '../infrastructure/stripe/factories/stripe-provider.factory';
import { StripeCancelIntentGateway } from '../infrastructure/stripe/gateways/intent/cancel-intent.gateway';
import { StripeConfirmIntentGateway } from '../infrastructure/stripe/gateways/intent/confirm-intent.gateway';
import { StripeCreateIntentGateway } from '../infrastructure/stripe/gateways/intent/create-intent.gateway';
import { StripeGetIntentGateway } from '../infrastructure/stripe/gateways/intent/get-intent.gateway';
import { IntentFacade } from '../infrastructure/stripe/gateways/intent/intent.facade';
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
  IntentFacade,
  StripeCreateIntentGateway,
  StripeConfirmIntentGateway,
  StripeCancelIntentGateway,
  StripeGetIntentGateway,
];
const STRIPE_FAKE_GATEWAYS: Provider[] = [
  {
    provide: IntentFacade,
    useFactory: () => FakePaymentGateway.create('stripe'),
  },
];

const PAYPAL_REAL_GATEWAYS: Provider[] = [PaypalPaymentGateway];
const PAYPAL_FAKE_GATEWAYS: Provider[] = [
  {
    provide: PaypalPaymentGateway,
    useFactory: () => FakePaymentGateway.create('paypal'),
  },
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

const USE_CASE_PROVIDERS: Provider[] = [
  StartPaymentUseCase,
  ConfirmPaymentUseCase,
  CancelPaymentUseCase,
  GetPaymentStatusUseCase,
];

const APPLICATION_PROVIDERS: Provider[] = [
  ProviderFactoryRegistry,
  FallbackOrchestratorService,
  PaymentsStore,
  { provide: PAYMENT_STATE, useClass: NgRxSignalsStateAdapter },
];

const SHARED_PROVIDERS: Provider[] = [IdempotencyKeyFactory];

function buildPaymentsProviders(options: PaymentsProvidersOptions = {}): Provider[] {
  const mode = options.mode ?? 'fake';

  return [
    ...selectGateways(mode),
    ...FACTORY_PROVIDERS,
    ...USE_CASE_PROVIDERS,
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
