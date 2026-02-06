import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { ProviderReferences } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider-references.types';

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
