/**
 * Test-only fake: schedules WEBHOOK_RECEIVED after X ms (use with fake timers).
 * Allows duplicates (same eventId) and out-of-order (schedule "older" after "newer").
 * Provider-agnostic.
 */
import type { WebhookReceivedPayload } from '@app/features/payments/application/adapters/events/flow/payment-flow.events';

export type SendWebhookFn = (payload: WebhookReceivedPayload) => void;

/**
 * Schedules a WEBHOOK_RECEIVED system event after delayMs.
 * Call harness.advance(delayMs) to fire (requires useFakeTimers: true).
 */
export function scheduleDelayedWebhook(
  sendWebhook: SendWebhookFn,
  payload: WebhookReceivedPayload,
  delayMs: number,
): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    sendWebhook(payload);
  }, delayMs);
}
