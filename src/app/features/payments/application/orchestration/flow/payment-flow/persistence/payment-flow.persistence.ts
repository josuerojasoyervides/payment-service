import type { PaymentFlowContext } from '@app/features/payments/domain/subdomains/payment/entities/payment-flow-context.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { ProviderReferences } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider-references.types';
import type { KeyValueStorage } from '@payments/application/api/contracts/key-value-storage.contract';
import { FLOW_CONTEXT_TTL_MS } from '@payments/application/orchestration/flow/payment-flow/context/payment-flow.context';

export const FLOW_CONTEXT_SCHEMA_VERSION = 1;

export interface PersistedFlowContext {
  schemaVersion: number;
  flowId: string;
  providerId?: PaymentProviderId;
  externalReference?: string;
  providerRefs?: ProviderReferences;
  createdAt?: number;
  expiresAt?: number;
  lastExternalEventId?: string;
  lastReturnNonce?: string;
  returnParamsSanitized?: Record<string, string>;
  returnUrl?: string;
  cancelUrl?: string;
  isTest?: boolean;
  persistedAt: number;
}

/**
 * Storage wrapper for flow context persistence and TTL cleanup.
 */
export class FlowContextStore {
  private readonly storageKey: string;
  private readonly now: () => number;

  constructor(
    private readonly storage: KeyValueStorage,
    options?: { key?: string; now?: () => number },
  ) {
    this.storageKey = options?.key ?? 'payment_flow_context_v1';
    this.now = options?.now ?? (() => Date.now());
  }

  save(context: PaymentFlowContext | null): PersistedFlowContext | null {
    if (!context?.flowId) return null;

    const now = this.now();
    const expiresAt = Math.min(
      context.expiresAt ?? now + FLOW_CONTEXT_TTL_MS,
      now + FLOW_CONTEXT_TTL_MS,
    );

    // Allowlist only: secrets (clientSecret, nextAction tokens, raw payloads, PII) are never persisted.
    const persisted: PersistedFlowContext = {
      schemaVersion: FLOW_CONTEXT_SCHEMA_VERSION,
      flowId: context.flowId,
      providerId: context.providerId,
      externalReference: context.externalReference,
      providerRefs: context.providerRefs,
      createdAt: context.createdAt,
      expiresAt,
      lastExternalEventId: context.lastExternalEventId,
      lastReturnNonce: context.lastReturnNonce,
      returnParamsSanitized: context.returnParamsSanitized,
      returnUrl: context.returnUrl,
      cancelUrl: context.cancelUrl,
      isTest: context.isTest,
      persistedAt: now,
    };

    this.storage.setItem(this.storageKey, JSON.stringify(persisted));
    return persisted;
  }

  load(): PersistedFlowContext | null {
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as PersistedFlowContext;
      if (!parsed?.flowId || parsed.schemaVersion !== FLOW_CONTEXT_SCHEMA_VERSION) {
        this.storage.removeItem(this.storageKey);
        return null;
      }

      if (this.isExpired(parsed)) {
        this.storage.removeItem(this.storageKey);
        return null;
      }

      return parsed;
    } catch {
      this.storage.removeItem(this.storageKey);
      return null;
    }
  }

  clear(): void {
    this.storage.removeItem(this.storageKey);
  }

  private isExpired(context: PersistedFlowContext): boolean {
    const now = this.now();
    const expiresAt = context.expiresAt ?? context.persistedAt + FLOW_CONTEXT_TTL_MS;
    return expiresAt <= now;
  }
}

/**
 * Restores a runtime flow context from persisted data.
 */
export function toFlowContext(persisted: PersistedFlowContext): PaymentFlowContext {
  return {
    flowId: persisted.flowId,
    providerId: persisted.providerId,
    externalReference: persisted.externalReference,
    providerRefs: persisted.providerRefs,
    createdAt: persisted.createdAt,
    expiresAt: persisted.expiresAt,
    lastExternalEventId: persisted.lastExternalEventId,
    lastReturnNonce: persisted.lastReturnNonce,
    returnParamsSanitized: persisted.returnParamsSanitized,
    returnUrl: persisted.returnUrl,
    cancelUrl: persisted.cancelUrl,
    isTest: persisted.isTest,
  };
}
