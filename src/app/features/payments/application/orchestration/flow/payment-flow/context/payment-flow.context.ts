/**
 * Flow context plumbing: create, merge, update, and resolve PaymentFlowContext.
 *
 * Responsibilities: flowId, TTL/expiration, externalReference correlation; providerRefs
 * merge per provider for reconciliation (each provider uses different IDs — intentId,
 * orderId, preferenceId, paymentId — so we keep a provider-keyed map and merge on updates).
 */
import type { PaymentFlowContext } from '@app/features/payments/domain/subdomains/payment/entities/payment-flow-context.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type {
  ProviderReferences,
  ProviderReferenceSet,
} from '@app/features/payments/domain/subdomains/payment/entities/payment-provider-references.types';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { FlowId } from '@payments/domain/common/primitives/ids/flow-id.vo';

export const FLOW_CONTEXT_TTL_MS = 30 * 60 * 1000;
export const PAYMENTS_RETURN_PATH = '/payments/return';
export const PAYMENTS_CANCEL_PATH = '/payments/cancel';

export type FlowIdGenerator = (nowMs: number) => string;

export const defaultFlowIdGenerator: FlowIdGenerator = (nowMs) => {
  const built = FlowId.build(nowMs, createRandomSuffix());
  return built.ok ? built.value.value : `flow_${nowMs.toString(36)}_${createRandomSuffix()}`;
};

export function resolvePaymentsReturnUrls(
  baseUrl?: string | null,
): { returnUrl: string; cancelUrl: string } | null {
  const origin = baseUrl ?? getBrowserOrigin();
  if (!origin) return null;
  return {
    returnUrl: `${origin}${PAYMENTS_RETURN_PATH}`,
    cancelUrl: `${origin}${PAYMENTS_CANCEL_PATH}`,
  };
}

export function ensureFlowContextUrls(
  context?: PaymentFlowContext | null,
  baseUrl?: string | null,
): PaymentFlowContext | null {
  const resolved = resolvePaymentsReturnUrls(baseUrl);
  if (!resolved) return context ?? null;
  const base = context ?? {};
  return {
    ...base,
    returnUrl: base.returnUrl ?? resolved.returnUrl,
    cancelUrl: base.cancelUrl ?? resolved.cancelUrl,
  };
}

/**
 * Builds a flow context with stable ids, timestamps, and provider references.
 */
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
  const externalReference = base.externalReference ?? params.request.orderId.value;

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

/**
 * Merges provider references into an existing flow context.
 */
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

/**
 * Resolves the most reliable reference id for status checks.
 */
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

function getBrowserOrigin(): string | null {
  if (typeof globalThis === 'undefined') return null;
  const location = (globalThis as { location?: Location }).location;
  if (!location?.origin) return null;
  return location.origin;
}
