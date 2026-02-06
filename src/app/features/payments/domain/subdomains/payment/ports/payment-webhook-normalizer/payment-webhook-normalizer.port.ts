import type { NormalizedWebhookEvent } from '@app/features/payments/domain/subdomains/payment/messages/payment-webhook.event';

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
