import { createPaymentError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import {
  createFlowContext,
  mergeExternalReference,
  resolveStatusReference,
  updateFlowContextProviderRefs,
} from '@payments/application/orchestration/flow/payment-flow/context/payment-flow.context';
import type {
  PaymentFlowEvent,
  PaymentFlowMachineContext,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';
import type { PaymentFlowConfig } from '@payments/application/orchestration/flow/payment-flow/policy/payment-flow.policy';
import { normalizePaymentError } from '@payments/application/orchestration/store/projection/payment-store.errors';
import { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';
import type { ActionFunction, Assigner, PropertyAssigner, ProvidedActor } from 'xstate';

type AssignFn<TActor extends ProvidedActor> = (
  assignment:
    | Assigner<PaymentFlowMachineContext, PaymentFlowEvent, undefined, PaymentFlowEvent, TActor>
    | PropertyAssigner<
        PaymentFlowMachineContext,
        PaymentFlowEvent,
        undefined,
        PaymentFlowEvent,
        TActor
      >,
) => ActionFunction<
  PaymentFlowMachineContext,
  PaymentFlowEvent,
  PaymentFlowEvent,
  undefined,
  TActor,
  never,
  never,
  never,
  never
>;

function toPaymentIntentIdOrNull(
  raw: string | PaymentIntentId | null | undefined,
): PaymentIntentId | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && 'value' in raw) return raw as PaymentIntentId;
  const result = PaymentIntentId.from(raw as string);
  return result.ok ? result.value : null;
}

/**
 * Input setters.
 */
const createInputActions = <TActor extends ProvidedActor>(assignFlow: AssignFn<TActor>) => ({
  setStartInput: assignFlow(({ event }) => {
    if (event.type !== 'START') return {};

    const flowContext = createFlowContext({
      providerId: event.providerId,
      request: event.request,
      existing: event.flowContext ?? null,
    });

    return {
      providerId: event.providerId,
      request: event.request,
      flowContext,
      intent: null,
      intentId: null,
      error: null,
      fallback: {
        eligible: false,
        mode: 'manual',
        failedProviderId: null,
        request: null,
        selectedProviderId: null,
      },
      polling: { attempt: 0 },
      statusRetry: { count: 0 },
    };
  }),

  setConfirmInput: assignFlow(({ event }) => {
    if (event.type !== 'CONFIRM') return {};

    return {
      providerId: event.providerId,
      intentId: event.intentId,
      intent: null,
      error: null,
      statusRetry: { count: 0 },
    };
  }),

  setCancelInput: assignFlow(({ event }) => {
    if (event.type !== 'CANCEL') return {};

    return {
      providerId: event.providerId,
      intentId: event.intentId,
      intent: null,
      error: null,
      statusRetry: { count: 0 },
    };
  }),

  setRefreshInput: assignFlow(({ event, context }) => {
    if (event.type !== 'REFRESH') return {};

    const providerId = event.providerId ?? context.providerId;
    const resolvedReference = resolveStatusReference(context.flowContext, providerId ?? null);

    const intentId = toPaymentIntentIdOrNull(
      event.intentId ?? resolvedReference ?? context.intentId ?? context.intent?.id ?? null,
    );

    return {
      providerId,
      intentId,
      error: null,
      statusRetry: { count: 0 },
    };
  }),

  setExternalEventInput: assignFlow(({ event, context }) => {
    if (
      event.type !== 'REDIRECT_RETURNED' &&
      event.type !== 'EXTERNAL_STATUS_UPDATED' &&
      event.type !== 'WEBHOOK_RECEIVED'
    )
      return {};

    const referenceId = event.payload.referenceId ?? '';
    const merged = referenceId
      ? mergeExternalReference({
          context: context.flowContext,
          providerId: event.payload.providerId,
          referenceId,
        })
      : null;
    const flowContext: PaymentFlowMachineContext['flowContext'] =
      merged ??
      (referenceId
        ? {
            providerId: event.payload.providerId,
            providerRefs: {
              [event.payload.providerId]: { paymentId: referenceId },
            },
          }
        : context.flowContext);

    const resolvedReference = resolveStatusReference(flowContext, event.payload.providerId);

    const intentId = toPaymentIntentIdOrNull(
      event.payload.referenceId ??
        resolvedReference ??
        context.intentId ??
        context.intent?.id ??
        null,
    );

    return {
      providerId: event.payload.providerId,
      intentId,
      flowContext,
      error: null,
      statusRetry: { count: 0 },
    };
  }),

  setFallbackRequested: assignFlow(({ event }) => {
    if (event.type !== 'FALLBACK_REQUESTED') return {};

    return {
      error: null,
      fallback: {
        eligible: true,
        mode: event.mode ?? 'manual',
        failedProviderId: event.failedProviderId,
        request: event.request,
        selectedProviderId: null,
      },
    };
  }),

  setFallbackStartInput: assignFlow(({ event, context }) => {
    if (event.type !== 'FALLBACK_EXECUTE') return {};

    return {
      providerId: event.providerId,
      request: event.request,
      intent: null,
      intentId: null,
      error: null,
      fallback: {
        ...context.fallback,
        eligible: true,
        request: event.request,
        failedProviderId: event.failedProviderId ?? context.fallback.failedProviderId,
        selectedProviderId: event.providerId,
      },
    };
  }),
});

/**
 * Intent and flow context updates.
 */
const createIntentActions = <TActor extends ProvidedActor>(assignFlow: AssignFn<TActor>) => ({
  setIntent: assignFlow(({ event, context }) => {
    if (!('output' in event)) return {};

    const providerRefs = event.output.providerRefs ?? {
      intentId: event.output.id.value,
    };
    const flowContext = updateFlowContextProviderRefs({
      context: context.flowContext,
      providerId: event.output.provider,
      refs: providerRefs,
    });

    const resolvedIntentId = toPaymentIntentIdOrNull(providerRefs?.intentId ?? event.output.id);
    return {
      intent: event.output,
      intentId: resolvedIntentId,
      flowContext,
      error: null,
      polling: { attempt: 0 },
      statusRetry: { count: 0 },
    };
  }),
});

/**
 * Errors.
 */
const createErrorActions = <TActor extends ProvidedActor>(
  assignFlow: AssignFn<TActor>,
  config: PaymentFlowConfig,
) => ({
  setError: assignFlow(({ event }) => {
    if (!('error' in event)) return {};
    return {
      intent: null,
      error: normalizePaymentError(event.error),
    };
  }),

  setRefreshError: assignFlow(({ context }) => {
    const missing = [
      !context.providerId ? 'providerId' : null,
      !(context.intentId ?? context.intent?.id) ? 'intentId' : null,
    ].filter(Boolean);

    return {
      error: normalizePaymentError(new Error(`Missing ${missing.join(' & ')} for REFRESH`)),
    };
  }),

  setExternalEventError: assignFlow(({ context }) => {
    const missing = [
      !context.providerId ? 'providerId' : null,
      !(context.intentId ?? context.intent?.id) ? 'referenceId' : null,
    ].filter(Boolean);

    return {
      error: normalizePaymentError(
        new Error(`Missing ${missing.join(' & ')} for external event reconciliation`),
      ),
    };
  }),

  setReturnCorrelationError: assignFlow(({ event, context }) => {
    if (event.type !== 'REDIRECT_RETURNED') return {};
    const storedRef = resolveStatusReference(context.flowContext, event.payload.providerId);
    const receivedId = event.payload.referenceId ?? '';
    return {
      error: createPaymentError(
        'return_correlation_mismatch',
        'errors.return_correlation_mismatch',
        { expectedId: storedRef ?? '', receivedId },
        null,
      ),
    };
  }),

  setProcessingTimeoutError: assignFlow(({ context }) => {
    const flowId = context.flowContext?.flowId ?? null;
    return {
      intent: null,
      error: createPaymentError(
        'processing_timeout',
        'errors.processing_timeout',
        {
          ...(flowId ? { flowId } : {}),
          attempt: context.polling.attempt,
          maxAttempts: config.polling.maxAttempts,
        },
        null,
      ),
    };
  }),

  clearError: assignFlow(() => ({ error: null })),
});

/**
 * Counters and cleanup.
 */
const createStateActions = <TActor extends ProvidedActor>(
  assignFlow: AssignFn<TActor>,
  config: PaymentFlowConfig,
) => ({
  clear: assignFlow(() => ({
    providerId: null,
    request: null,
    flowContext: null,
    intent: null,
    intentId: null,
    error: null,
    fallback: {
      eligible: false,
      mode: 'manual',
      failedProviderId: null,
      request: null,
      selectedProviderId: null,
    },
    polling: { attempt: 0 },
    statusRetry: { count: 0 },
  })),

  incrementPollAttempt: assignFlow(({ context }) => ({
    polling: {
      attempt: Math.min(context.polling.attempt + 1, config.polling.maxAttempts),
    },
  })),

  incrementStatusRetry: assignFlow(({ context }) => ({
    statusRetry: {
      count: Math.min(context.statusRetry.count + 1, config.statusRetry.maxRetries),
    },
  })),
});

/**
 * External event tracking.
 */
const createTrackingActions = <TActor extends ProvidedActor>(assignFlow: AssignFn<TActor>) => ({
  markReturnProcessed: assignFlow(({ event, context }) => {
    if (event.type !== 'REDIRECT_RETURNED') return {};
    const refId = event.payload.referenceId ?? '';
    const flowContext = context.flowContext
      ? {
          ...context.flowContext,
          // Keep both for backwards compatibility; lastReturnNonce is the primary
          // dedupe key, lastReturnReferenceId remains as an audit hint.
          lastReturnNonce: context.flowContext.lastReturnNonce ?? refId,
          lastReturnReferenceId: refId,
          lastReturnAt: Date.now(),
        }
      : null;
    return { flowContext };
  }),

  markExternalEventProcessed: assignFlow(({ event, context }) => {
    if (event.type !== 'EXTERNAL_STATUS_UPDATED' && event.type !== 'WEBHOOK_RECEIVED') return {};

    const eventId = (event.payload as { eventId?: string }).eventId;
    if (!eventId) return {};

    const flowContext = context.flowContext
      ? {
          ...context.flowContext,
          lastExternalEventId: eventId,
        }
      : null;

    return { flowContext };
  }),
});

export const createPaymentFlowActions = <TActor extends ProvidedActor>(
  assignFlow: AssignFn<TActor>,
  config: PaymentFlowConfig,
) => ({
  noop: () => undefined,
  ...createInputActions(assignFlow),
  ...createIntentActions(assignFlow),
  ...createErrorActions(assignFlow, config),
  ...createStateActions(assignFlow, config),
  ...createTrackingActions(assignFlow),
});
