import type { EnvironmentProviders } from '@angular/core';
import { type Provider } from '@angular/core';
import { ExternalEventAdapter } from '@payments/application/adapters/external-event.adapter';
import { NgRxSignalsStateAdapter } from '@payments/application/adapters/ngrx-signals-state.adapter';
import { PaymentHistoryFacade } from '@payments/application/api/facades/payment-history.facade';
import { CLIENT_CONFIRM_PORTS } from '@payments/application/api/tokens/client-confirm.token';
import { FINALIZE_PORTS } from '@payments/application/api/tokens/finalize.token';
import { PAYMENT_STATE } from '@payments/application/api/tokens/payment-state.token';
import { PaymentFlowActorService } from '@payments/application/orchestration/flow/payment-flow.actor.service';
import { PaymentFlowFacade } from '@payments/application/orchestration/flow/payment-flow.facade';
import { ProviderFactoryRegistry } from '@payments/application/orchestration/registry/provider-factory.registry';
import { ProviderMethodPolicyRegistry } from '@payments/application/orchestration/registry/provider-method-policy.registry';
import { FallbackOrchestratorService } from '@payments/application/orchestration/services/fallback-orchestrator.service';
import { NextActionOrchestratorService } from '@payments/application/orchestration/services/next-action-orchestrator.service';
import { PaymentsStore } from '@payments/application/orchestration/store/payment-store';
import { CancelPaymentUseCase } from '@payments/application/orchestration/use-cases/cancel-payment.use-case';
import { ConfirmPaymentUseCase } from '@payments/application/orchestration/use-cases/confirm-payment.use-case';
import { GetPaymentStatusUseCase } from '@payments/application/orchestration/use-cases/get-payment-status.use-case';
import { StartPaymentUseCase } from '@payments/application/orchestration/use-cases/start-payment.use-case';
import {
  type PaymentsProvidersMode,
  type PaymentsProvidersOptions,
} from '@payments/config/payments-providers.types';
import { providePaypalProviderConfig } from '@payments/config/providers/paypal.providers';
import { provideStripeProviderConfig } from '@payments/config/providers/stripe.providers';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';

function selectProviderConfigs(mode: PaymentsProvidersMode): Provider[] {
  return [...provideStripeProviderConfig(mode), ...providePaypalProviderConfig(mode)];
}

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
    ...selectProviderConfigs(mode),
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
export type { PaymentsProvidersMode, PaymentsProvidersOptions } from './payments-providers.types';
