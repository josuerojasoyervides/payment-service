import {
  PaymentFlowContext,
  ProviderReferences,
  ProviderReferenceSet,
} from '@payments/domain/models/payment/payment-flow-context.types';
import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';

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
