import type { PaymentFlowMachineContext } from '@payments/application/orchestration/flow/payment-flow.types';
import type { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';

export interface PaymentFlowConfig {
  polling: {
    baseDelayMs: number;
    maxDelayMs: number;
    maxAttempts: number;
  };
  statusRetry: {
    baseDelayMs: number;
    maxDelayMs: number;
    maxRetries: number;
  };
}

export type PaymentFlowConfigOverrides = Partial<{
  polling: Partial<PaymentFlowConfig['polling']>;
  statusRetry: Partial<PaymentFlowConfig['statusRetry']>;
}>;

export const DEFAULT_PAYMENT_FLOW_CONFIG: PaymentFlowConfig = {
  polling: {
    baseDelayMs: 1500,
    maxDelayMs: 10000,
    maxAttempts: 12,
  },
  statusRetry: {
    baseDelayMs: 500,
    maxDelayMs: 5000,
    maxRetries: 2,
  },
};

export function resolvePaymentFlowConfig(
  overrides: PaymentFlowConfigOverrides = {},
): PaymentFlowConfig {
  return {
    polling: {
      ...DEFAULT_PAYMENT_FLOW_CONFIG.polling,
      ...(overrides.polling ?? {}),
    },
    statusRetry: {
      ...DEFAULT_PAYMENT_FLOW_CONFIG.statusRetry,
      ...(overrides.statusRetry ?? {}),
    },
  };
}

export function isFinalStatus(status?: string) {
  return status === 'succeeded' || status === 'failed' || status === 'canceled';
}

export function needsUserAction(intent?: PaymentIntent | null) {
  if (!intent) return false;
  const action = intent.nextAction;
  const actionable = action ? action.kind !== 'external_wait' : false;
  return intent.status === 'requires_action' || !!intent.redirectUrl || actionable;
}

export function needsClientConfirm(intent?: PaymentIntent | null): boolean {
  return intent?.nextAction?.kind === 'client_confirm';
}

export function needsFinalize(intent?: PaymentIntent | null): boolean {
  return intent?.finalizeRequired === true;
}

export function hasIntentPolicy(context: PaymentFlowMachineContext): boolean {
  return !!context.intent;
}

export function needsUserActionPolicy(context: PaymentFlowMachineContext): boolean {
  return needsUserAction(context.intent);
}

export function needsClientConfirmPolicy(context: PaymentFlowMachineContext): boolean {
  return needsClientConfirm(context.intent);
}

export function needsFinalizePolicy(context: PaymentFlowMachineContext): boolean {
  return needsFinalize(context.intent);
}

export function isFinalIntentPolicy(context: PaymentFlowMachineContext): boolean {
  return isFinalStatus(context.intent?.status);
}

export function hasRefreshKeysPolicy(context: PaymentFlowMachineContext): boolean {
  return !!context.providerId && !!(context.intentId ?? context.intent?.id);
}

export function canFallbackPolicy(context: PaymentFlowMachineContext): boolean {
  return (
    context.fallback.eligible && !!context.fallback.request && !!context.fallback.failedProviderId
  );
}

export function canPollPolicy(
  config: PaymentFlowConfig,
  context: PaymentFlowMachineContext,
): boolean {
  return context.polling.attempt < config.polling.maxAttempts;
}

export function canRetryStatusPolicy(
  config: PaymentFlowConfig,
  context: PaymentFlowMachineContext,
): boolean {
  return context.statusRetry.count < config.statusRetry.maxRetries;
}

export function getPollingDelayMs(config: PaymentFlowConfig, attempt: number): number {
  const delay = config.polling.baseDelayMs * Math.pow(2, Math.max(0, attempt));
  return Math.min(delay, config.polling.maxDelayMs);
}

export function getStatusRetryDelayMs(config: PaymentFlowConfig, count: number): number {
  const delay = config.statusRetry.baseDelayMs * Math.pow(2, Math.max(0, count));
  return Math.min(delay, config.statusRetry.maxDelayMs);
}
