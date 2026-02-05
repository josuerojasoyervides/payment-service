/**
 * Config layer: DI wiring for the payments feature.
 *
 * Binds PAYMENT_STATE (PaymentFlowPort) and PAYMENT_CHECKOUT_CATALOG (PaymentCheckoutCatalogPort)
 * to the same adapter (NgRxSignalsStateAdapter) via useExisting.
 * Composition root for providers, use cases, stores, and infra.
 */
import type { EnvironmentProviders } from '@angular/core';
import { isDevMode, type Provider } from '@angular/core';
import { ExternalEventAdapter } from '@app/features/payments/application/adapters/events/external/external-event.adapter';
import { CompositeFlowTelemetrySink } from '@app/features/payments/application/adapters/telemetry/composite-flow-telemetry-sink';
import { ConsoleFlowTelemetrySink } from '@app/features/payments/application/adapters/telemetry/dev-only/console-flow-telemetry-sink';
import { InMemoryFlowTelemetrySink } from '@app/features/payments/application/adapters/telemetry/dev-only/in-memory-flow-telemetry-sink';
import { NoopFlowTelemetrySink } from '@app/features/payments/application/adapters/telemetry/prod-only/noop-flow-telemetry-sink';
import type { KeyValueStorage } from '@app/features/payments/application/api/contracts/key-value-storage.contract';
import type { ExternalNavigatorPort } from '@app/features/payments/application/api/ports/external-navigator.port';
import { FLOW_CONTEXT_STORAGE } from '@app/features/payments/application/api/tokens/flow/flow-context-storage.token';
import { EXTERNAL_NAVIGATOR } from '@app/features/payments/application/api/tokens/navigation/external-navigator.token';
import { PAYMENT_CHECKOUT_CATALOG } from '@app/features/payments/application/api/tokens/store/payment-checkout-catalog.token';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import {
  FLOW_TELEMETRY_SINK,
  FLOW_TELEMETRY_SINKS,
} from '@app/features/payments/application/api/tokens/telemetry/flow-telemetry-sink.token';
import { WEBHOOK_NORMALIZER_REGISTRY } from '@app/features/payments/application/api/tokens/webhook/webhook-normalizer-registry.token';
import { PaymentFlowMachineDriver } from '@app/features/payments/application/orchestration/flow/payment-flow/deps/payment-flow-machine-driver';
import { ProviderFactoryRegistry } from '@app/features/payments/application/orchestration/registry/provider-factory/provider-factory.registry';
import { ProviderMethodPolicyRegistry } from '@app/features/payments/application/orchestration/registry/provider-method-policy/provider-method-policy.registry';
import { FallbackOrchestratorService } from '@app/features/payments/application/orchestration/services/fallback/fallback-orchestrator.service';
import { NextActionOrchestratorService } from '@app/features/payments/application/orchestration/services/next-action/next-action-orchestrator.service';
import { CancelPaymentUseCase } from '@app/features/payments/application/orchestration/use-cases/intent/cancel-payment.use-case';
import { ConfirmPaymentUseCase } from '@app/features/payments/application/orchestration/use-cases/intent/confirm-payment.use-case';
import { GetPaymentStatusUseCase } from '@app/features/payments/application/orchestration/use-cases/intent/get-payment-status.use-case';
import { StartPaymentUseCase } from '@app/features/payments/application/orchestration/use-cases/intent/start-payment.use-case';
import { BrowserExternalNavigator } from '@app/features/payments/infrastructure/browser/adapters/browser-external-navigator.adapter';
import { BrowserStorageAdapter } from '@app/features/payments/infrastructure/browser/adapters/browser-storage.adapter';
import { NoopExternalNavigator } from '@app/features/payments/infrastructure/browser/adapters/noop-external-navigator.adapter';
import { NoopStorageAdapter } from '@app/features/payments/infrastructure/browser/adapters/noop-storage.adapter';
import { ThrowingExternalNavigator } from '@app/features/payments/infrastructure/browser/adapters/throwing-external-navigator.adapter';
import {
  PaypalWebhookNormalizer,
  providePaypalPayments,
} from '@app/features/payments/infrastructure/paypal/core/di/provide-paypal-payments';
import {
  provideStripePayments,
  StripeWebhookNormalizer,
} from '@app/features/payments/infrastructure/stripe/core/di/provide-stripe-payments';
import { UI_PROVIDERS } from '@app/features/payments/ui/config/ui-providers';
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
import { PAYMENTS_INFRA_CONFIG } from '@payments/infrastructure/config/payments-infra-config.token';
import type {
  PaymentsInfraConfig,
  PaymentsInfraConfigInput,
} from '@payments/infrastructure/config/payments-infra-config.types';
import { providePaymentsInfraConfig } from '@payments/infrastructure/config/provide-payments-infra-config';
import { ProviderDescriptorRegistry } from '@payments/presentation/registry/provider-descriptor/provider-descriptor.registry';
import { SPEI_DISPLAY_CONFIG } from '@payments/presentation/tokens/spei-display-config.token';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';

function selectProviderConfigs(mode: PaymentsProvidersMode): Provider[] {
  return [...provideStripePayments(mode), ...providePaypalPayments(mode)];
}

function selectTelemetryProviders(): Provider[] {
  const sinks: Provider[] = [
    // composite concrete
    CompositeFlowTelemetrySink,
    // single sink consumed by the flow
    { provide: FLOW_TELEMETRY_SINK, useExisting: CompositeFlowTelemetrySink },
  ];

  if (isDevMode()) {
    sinks.push(
      { provide: FLOW_TELEMETRY_SINKS, useClass: InMemoryFlowTelemetrySink, multi: true },
      { provide: FLOW_TELEMETRY_SINKS, useClass: ConsoleFlowTelemetrySink, multi: true },
    );
  } else {
    sinks.push({ provide: FLOW_TELEMETRY_SINKS, useClass: NoopFlowTelemetrySink, multi: true });
  }

  return [...sinks];
}

function selectFlowContextStorage(): KeyValueStorage {
  const storage =
    typeof globalThis !== 'undefined' && 'localStorage' in globalThis
      ? (globalThis as { localStorage?: Storage }).localStorage
      : undefined;

  if (storage) return new BrowserStorageAdapter(storage);
  return new NoopStorageAdapter();
}

function selectExternalNavigator(): ExternalNavigatorPort {
  const hasWindow = typeof window !== 'undefined' && !!window.location;
  if (hasWindow) return new BrowserExternalNavigator();
  return isDevMode() ? new ThrowingExternalNavigator() : new NoopExternalNavigator();
}

function selectPresentationProviders(): Provider[] {
  return [
    {
      provide: SPEI_DISPLAY_CONFIG,
      useFactory: (config: PaymentsInfraConfig) => config.spei.displayConfig,
      deps: [PAYMENTS_INFRA_CONFIG],
    },
  ];
}

const DEFAULT_PAYMENTS_INFRA_CONFIG: PaymentsInfraConfigInput = {
  paymentsBackendBaseUrl: '/api/payments',
  timeouts: {
    stripeMs: 15_000,
    paypalMs: 15_000,
  },
  paypal: {
    defaults: {
      brand_name: 'Payment Service',
      landing_page: 'NO_PREFERENCE',
      user_action: 'PAY_NOW',
    },
  },
  spei: {
    displayConfig: {
      receivingBanks: {
        STP: 'STP (Transfers and Payments System)',
      },
      beneficiaryName: 'Payment Service',
    },
  },
};

function selectInfraConfigProviders(): Provider[] {
  return [providePaymentsInfraConfig(DEFAULT_PAYMENTS_INFRA_CONFIG)];
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
  // Adapters
  ExternalEventAdapter,
  // Registry
  ProviderDescriptorRegistry,
  ProviderFactoryRegistry,
  ProviderMethodPolicyRegistry,
  // Orchestration
  FallbackOrchestratorService,
  NextActionOrchestratorService,
  // Flow machine
  PaymentFlowActorService,
  PaymentFlowMachineDriver,
  PaymentHistoryFacade,
  // Store
  PaymentsStore,
  NgRxSignalsStateAdapter,
  { provide: PAYMENT_STATE, useExisting: NgRxSignalsStateAdapter },
  { provide: PAYMENT_CHECKOUT_CATALOG, useExisting: NgRxSignalsStateAdapter },
  // Telemetry providers
  ...selectTelemetryProviders(),
];

const SHARED_PROVIDERS: Provider[] = [IdempotencyKeyFactory];
const ENV_PROVIDERS: Provider[] = [
  { provide: FLOW_CONTEXT_STORAGE, useFactory: selectFlowContextStorage },
  { provide: EXTERNAL_NAVIGATOR, useFactory: selectExternalNavigator },
];

function buildPaymentsProviders(options: PaymentsProvidersOptions = {}): Provider[] {
  const mode = options.mode ?? 'fake';

  return [
    ...selectInfraConfigProviders(),
    ...selectProviderConfigs(mode),
    ...USE_CASE_PROVIDERS,
    ...ACTION_PORT_PROVIDERS,
    ...APPLICATION_PROVIDERS,
    ...SHARED_PROVIDERS,
    ...ENV_PROVIDERS,
    ...UI_PROVIDERS,
    ...selectPresentationProviders(),
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
