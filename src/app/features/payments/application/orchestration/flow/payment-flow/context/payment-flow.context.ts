/**
 * Flow context plumbing: create, merge, update, and resolve PaymentFlowContext.
 *
 * Responsibilities: flowId, TTL/expiration, externalReference correlation; providerRefs
 * merge per provider for reconciliation (each provider uses different IDs — intentId,
 * orderId, preferenceId, paymentId — so we keep a provider-keyed map and merge on updates).
 */
import type {
  PaymentFlowContext,
  ProviderReferences,
  ProviderReferenceSet,
} from '@payments/domain/subdomains/payment/contracts/payment-flow-context.types';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';

export const FLOW_CONTEXT_TTL_MS = 30 * 60 * 1000;

export type FlowIdGenerator = (nowMs: number) => string;

export const defaultFlowIdGenerator: FlowIdGenerator = (nowMs) => {
  return `flow_${nowMs.toString(36)}_${createRandomSuffix()}`;
};

export function createFlowContext(params: {
  providerId: PaymentProviderId;
  request: CreatePaymentRequest;
  existing?: PaymentFlowContext | null;
  nowMs?: number;
  flowIdGenerator?: FlowIdGenerator;
}): PaymentFlowContext {
  const nowMs = params.nowMs ?? Date.now();
  const base = params.existing ?? {};
  const flowIdGenerator = params.flowIdGenerator ?? defaultFlowIdGenerator;

  const flowId = base.flowId ?? flowIdGenerator(nowMs);
  const createdAt = base.createdAt ?? nowMs;
  const expiresAt = base.expiresAt ?? nowMs + FLOW_CONTEXT_TTL_MS;
  const externalReference = base.externalReference ?? params.request.orderId;

  const providerRefs = mergeProviderRefs(base.providerRefs, {
    [params.providerId]: base.providerRefs?.[params.providerId] ?? {},
  });

  return {
    ...base,
    flowId,
    providerId: params.providerId,
    externalReference,
    providerRefs,
    createdAt,
    expiresAt,
  };
}

export function mergeProviderRefs(
  base?: ProviderReferences,
  update?: ProviderReferences,
): ProviderReferences {
  const result: ProviderReferences = { ...(base ?? {}) };
  if (!update) return result;

  Object.entries(update).forEach(([providerId, refs]) => {
    const existing = result[providerId as PaymentProviderId] ?? {};
    const merged = mergeReferenceSet(existing, refs ?? {});
    result[providerId as PaymentProviderId] = merged;
  });

  return result;
}

export function updateFlowContextProviderRefs(params: {
  context: PaymentFlowContext | null;
  providerId: PaymentProviderId;
  refs: ProviderReferenceSet;
}): PaymentFlowContext | null {
  if (!params.context) return params.context;

  const providerRefs = mergeProviderRefs(params.context.providerRefs, {
    [params.providerId]: params.refs,
  });

  return {
    ...params.context,
    providerId: params.context.providerId ?? params.providerId,
    providerRefs,
  };
}

export function resolveStatusReference(
  context: PaymentFlowContext | null,
  providerId: PaymentProviderId | null,
): string | null {
  if (!context || !providerId) return null;
  const refs = context.providerRefs?.[providerId];
  return refs?.paymentId ?? refs?.orderId ?? refs?.intentId ?? refs?.preferenceId ?? null;
}

export function mergeExternalReference(params: {
  context: PaymentFlowContext | null;
  providerId: PaymentProviderId;
  referenceId: string;
}): PaymentFlowContext | null {
  if (!params.context) return params.context;

  return updateFlowContextProviderRefs({
    context: params.context,
    providerId: params.providerId,
    refs: { paymentId: params.referenceId },
  });
}

function mergeReferenceSet(
  base: ProviderReferenceSet,
  update: ProviderReferenceSet,
): ProviderReferenceSet {
  const merged: ProviderReferenceSet = { ...base };
  Object.entries(update).forEach(([key, value]) => {
    if (value !== undefined) merged[key] = value;
  });
  return merged;
}

function createRandomSuffix(): string {
  if (typeof globalThis === 'undefined' || !globalThis.crypto) {
    throw new Error('Secure random generator is not available');
  }

  if (globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  }

  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
