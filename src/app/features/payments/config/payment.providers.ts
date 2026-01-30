/**
 * Config layer: DI wiring for the payments feature.
 *
 * Binds PAYMENT_STATE (PaymentFlowPort) and PAYMENT_CHECKOUT_CATALOG (PaymentCheckoutCatalogPort)
 * to the same adapter (NgRxSignalsStateAdapter) via useExisting.
 * Composition root for providers, use cases, stores, and infra.
 */
import type { EnvironmentProviders } from '@angular/core';
import { type Provider } from '@angular/core';
import { ExternalEventAdapter } from '@app/features/payments/application/adapters/events/external/external-event.adapter';
import { NoopFlowTelemetrySink } from '@app/features/payments/application/adapters/telemetry/prod-only/noop-flow-telemetry-sink';
import { PAYMENT_CHECKOUT_CATALOG } from '@app/features/payments/application/api/tokens/store/payment-checkout-catalog.token';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import { FLOW_TELEMETRY_SINK } from '@app/features/payments/application/api/tokens/telemetry/flow-telemetry-sink.token';
import { WEBHOOK_NORMALIZER_REGISTRY } from '@app/features/payments/application/api/tokens/webhook/webhook-normalizer-registry.token';
import { PaymentFlowMachineDriver } from '@app/features/payments/application/orchestration/flow/payment-flow-machine-driver';
import { ProviderFactoryRegistry } from '@app/features/payments/application/orchestration/registry/provider-factory/provider-factory.registry';
import { ProviderMethodPolicyRegistry } from '@app/features/payments/application/orchestration/registry/provider-method-policy/provider-method-policy.registry';
import { FallbackOrchestratorService } from '@app/features/payments/application/orchestration/services/fallback/fallback-orchestrator.service';
import { NextActionOrchestratorService } from '@app/features/payments/application/orchestration/services/next-action/next-action-orchestrator.service';
import { CancelPaymentUseCase } from '@app/features/payments/application/orchestration/use-cases/intent/cancel-payment.use-case';
import { ConfirmPaymentUseCase } from '@app/features/payments/application/orchestration/use-cases/intent/confirm-payment.use-case';
import { GetPaymentStatusUseCase } from '@app/features/payments/application/orchestration/use-cases/intent/get-payment-status.use-case';
import { StartPaymentUseCase } from '@app/features/payments/application/orchestration/use-cases/intent/start-payment.use-case';
import {
  PaypalWebhookNormalizer,
  providePaypalPayments,
} from '@app/features/payments/infrastructure/paypal/core/di/provide-paypal-payments';
import {
  provideStripePayments,
  StripeWebhookNormalizer,
} from '@app/features/payments/infrastructure/stripe/core/di/provide-stripe-payments';
import { NgRxSignalsStateAdapter } from '@payments/application/adapters/state/ngrx-signals-state.adapter';
import { PaymentHistoryFacade } from '@payments/application/api/facades/payment-history.facade';
import { CLIENT_CONFIRM_PORTS } from '@payments/application/api/tokens/operations/client-confirm.token';
import { FINALIZE_PORTS } from '@payments/application/api/tokens/operations/finalize.token';
import { PaymentFlowActorService } from '@payments/application/orchestration/flow/payment-flow.actor.service';
import { PaymentsStore } from '@payments/application/orchestration/store/payment-store';
import {
  type PaymentsProvidersMode,
  type PaymentsProvidersOptions,
} from '@payments/config/payments-providers.types';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';

function selectProviderConfigs(mode: PaymentsProvidersMode): Provider[] {
  return [...provideStripePayments(mode), ...providePaypalPayments(mode)];
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
  PaymentFlowMachineDriver,
  PaymentHistoryFacade,
  NgRxSignalsStateAdapter,
  { provide: PAYMENT_STATE, useExisting: NgRxSignalsStateAdapter },
  { provide: PAYMENT_CHECKOUT_CATALOG, useExisting: NgRxSignalsStateAdapter },
  { provide: FLOW_TELEMETRY_SINK, useClass: NoopFlowTelemetrySink },
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
    {
      provide: WEBHOOK_NORMALIZER_REGISTRY,
      useValue: {
        stripe: new StripeWebhookNormalizer(),
        paypal: new PaypalWebhookNormalizer(),
      },
    },
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
