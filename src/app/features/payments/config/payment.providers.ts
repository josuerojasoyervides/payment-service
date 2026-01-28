import type { EnvironmentProviders} from '@angular/core';
import { type Provider } from '@angular/core';
import { PaymentHistoryFacade } from '@payments/application/api/facades/payment-history.facade';
import { PaymentFlowActorService } from '@payments/application/orchestration/flow/payment-flow.actor.service';
import { PaymentFlowFacade } from '@payments/application/orchestration/flow/payment-flow.facade';

import { ExternalEventAdapter } from '../application/adapters/external-event.adapter';
import { NgRxSignalsStateAdapter } from '../application/adapters/ngrx-signals-state.adapter';
import { CLIENT_CONFIRM_PORTS } from '../application/api/tokens/client-confirm.token';
import { FINALIZE_PORTS } from '../application/api/tokens/finalize.token';
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
import { IdempotencyKeyFactory } from '../shared/idempotency/idempotency-key.factory';
import {
  type PaymentsProvidersMode,
  type PaymentsProvidersOptions,
} from './payments-providers.types';
import { providePaypalProviderConfig } from './providers/paypal.providers';
import { provideStripeProviderConfig } from './providers/stripe.providers';

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
