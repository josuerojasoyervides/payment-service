import type { PaymentIntentStatus } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { ProviderReferences } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider-references.types';

/**
 * Provider-agnostic representation of a webhook event that can be fed into
 * the payment flow as a semantic external signal.
 */
export interface NormalizedWebhookEvent {
  /** Provider-specific event identifier used for deduplication. */
  eventId: string;

  /** The payment provider that emitted the event. */
  providerId: PaymentProviderId;

  /**
   * Provider-specific references (intent/order/capture IDs, etc.).
   * These are used to reconcile the webhook with the current FlowContext.
   */
  providerRefs: ProviderReferences;

  /**
   * Optional mapped intent status when the webhook represents a concrete
   * status transition (e.g. succeeded / failed / processing).
   */
  status?: PaymentIntentStatus;

  /** When the event occurred (epoch ms). */
  occurredAt: number;

  /**
   * Optional redacted raw payload for observability/debugging.
   * Implementations must avoid storing secrets or PII here.
   */
  raw?: unknown;
}
