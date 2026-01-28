import {
  PaymentFlowContext,
  ProviderReferences,
} from '@payments/domain/models/payment/payment-flow-context.types';
import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';

import { FLOW_CONTEXT_TTL_MS } from './payment-flow.context';

export interface PersistedFlowContext {
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

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

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
      if (!parsed?.flowId) {
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
