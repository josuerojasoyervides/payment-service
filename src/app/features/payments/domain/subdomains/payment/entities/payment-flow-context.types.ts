import type { PaymentProviderId } from '@payments/domain/subdomains/payment/entities/payment-intent.types';

export type ProviderReferenceKey = 'intentId' | 'orderId' | 'preferenceId' | 'paymentId';

/**
 * Provider reference bag.
 * - Known keys are suggested via `ProviderReferenceKey`.
 * - Additional provider-specific keys are allowed as optional string entries.
 */
export type ProviderReferenceSet = Partial<Record<ProviderReferenceKey, string>> &
  Record<string, string | undefined>;

export type ProviderRefs = ProviderReferenceSet;
export type ProviderReferences = Partial<Record<PaymentProviderId, ProviderRefs>>;

export interface PaymentFlowContext {
  flowId?: string;
  providerId?: PaymentProviderId;

  externalReference?: string;
  providerRefs?: ProviderReferences;

  createdAt?: number;
  expiresAt?: number;

  lastExternalEventId?: string;

  lastReturnNonce?: string;

  /**
   * Dedupe guard: skip finalize if the same reference id was already processed.
   */
  lastReturnReferenceId?: string;

  lastReturnAt?: number;

  returnParamsSanitized?: Record<string, string>;

  returnUrl?: string;
  cancelUrl?: string;

  isTest?: boolean;

  deviceData?: {
    ipAddress?: string;
    userAgent?: string;
    screenWidth?: number;
    screenHeight?: number;
  };

  metadata?: Record<string, unknown>;
}
