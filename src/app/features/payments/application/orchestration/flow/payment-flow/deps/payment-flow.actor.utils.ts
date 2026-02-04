import type { FlowTelemetryRefs } from '@app/features/payments/application/adapters/telemetry/types/flow-telemetry.types';
import type { PaymentFlowContext } from '@app/features/payments/domain/subdomains/payment/entities/payment-flow-context.types';
import type { NextAction } from '@app/features/payments/domain/subdomains/payment/entities/payment-next-action.model';
import type {
  PaymentFlowMachineContext,
  PaymentFlowSnapshot,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';
import type { FlowContextStore } from '@payments/application/orchestration/flow/payment-flow/persistence/payment-flow.persistence';
import { toFlowContext } from '@payments/application/orchestration/flow/payment-flow/persistence/payment-flow.persistence';
import { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';

export function buildInitialMachineContext(
  store: FlowContextStore,
): Partial<PaymentFlowMachineContext> | undefined {
  const persisted = store?.load();
  if (!persisted) return undefined;

  const flowContext = toFlowContext(persisted);
  const providerId = flowContext.providerId ?? null;
  const raw =
    providerId != null ? (flowContext.providerRefs?.[providerId]?.intentId ?? null) : null;
  const fromRaw = raw != null ? PaymentIntentId.from(raw) : null;
  const intentId = fromRaw?.ok ? fromRaw.value : null;

  return {
    flowContext,
    providerId,
    intentId,
  };
}

export function redactNextAction(action?: NextAction): NextAction | undefined {
  if (!action) return action;
  if (action.kind !== 'client_confirm') return action;
  return { ...action, token: '[redacted]' };
}

export function redactFlowContext(context: PaymentFlowContext | null): PaymentFlowContext | null {
  return context ?? null;
}

export function redactIntent(
  intent: PaymentFlowSnapshot['context']['intent'],
): PaymentFlowSnapshot['context']['intent'] {
  if (!intent) return intent;
  return {
    ...intent,
    clientSecret: intent.clientSecret ? '[redacted]' : intent.clientSecret,
    nextAction: redactNextAction(intent.nextAction),
    raw: undefined,
  };
}

// Effect phases are defined by tags on the machine states (stable across refactors).
export const EFFECT_TAGS = [
  'starting',
  'fetchingStatusInvoke',
  'reconciling',
  'finalizing',
  'clientConfirming',
] as const;

export type EffectTag = (typeof EFFECT_TAGS)[number];

export function resolveEffectTag(snapshot: PaymentFlowSnapshot): EffectTag | null {
  for (const tag of EFFECT_TAGS) {
    if (snapshot.hasTag(tag)) return tag;
  }
  return null;
}

export function flowContextToRefs(
  flowContext: PaymentFlowContext | null,
  providerId: string | null,
): FlowTelemetryRefs | undefined {
  if (!flowContext?.providerRefs || !providerId) return undefined;
  const refs = flowContext.providerRefs[providerId as keyof typeof flowContext.providerRefs];
  if (!refs || typeof refs !== 'object') return undefined;
  return refs as FlowTelemetryRefs;
}

export function snapshotTelemetryBase(snapshot: PaymentFlowSnapshot): {
  flowId?: string;
  providerId?: string;
  refs?: FlowTelemetryRefs;
} {
  const flowContext = snapshot.context.flowContext;
  const providerId = snapshot.context.providerId ?? undefined;
  return {
    flowId: flowContext?.flowId,
    providerId: providerId ?? undefined,
    refs: flowContext
      ? flowContextToRefs(flowContext, snapshot.context.providerId ?? null)
      : undefined,
  };
}
