import type { ProviderReferences } from '@payments/domain/subdomains/payment/contracts/payment-flow-context.types';
import type {
  PaymentIntentStatus,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';

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

/**
 * Port for provider-specific webhook normalizers.
 *
 * Implementations live under `infrastructure/<provider>/...` and are
 * responsible for mapping raw provider webhook payloads into the
 * provider-agnostic `NormalizedWebhookEvent` contract.
 */
export interface WebhookNormalizer<TPayload = unknown, THeaders = Record<string, unknown>> {
  /**
   * Normalize a provider-specific webhook payload into a domain event.
   *
   * @returns a `NormalizedWebhookEvent` when the payload is recognized and
   *          relevant to the payment flow, or `null` when it should be ignored.
   */
  normalize(payload: TPayload, headers: THeaders): NormalizedWebhookEvent | null;
}
