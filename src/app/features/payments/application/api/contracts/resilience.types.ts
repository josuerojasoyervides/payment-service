import type { PaymentErrorCode } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';

/**
 * Data required to render a fallback confirmation UI.
 */
export interface FallbackConfirmationData {
  /** Providers available for fallback. */
  eligibleProviders: PaymentProviderId[];
  /** Reason for fallback (normalized error code). */
  failureReason: PaymentErrorCode;
  /** Timeout window for user decision. */
  timeoutMs: number;
}

/**
 * Data required to render a manual review UI.
 */
export interface ManualReviewData {
  intentId: string;
  providerId: PaymentProviderId;
  /** Provider dashboard URL for manual review. */
  dashboardUrl: string;
}

/**
 * Provider-specific resilience configuration (optional).
 * Values are in milliseconds.
 */
export interface ProviderResilienceConfig {
  circuitOpenCooldownMs?: number;
  rateLimitCooldownMs?: number;
}
