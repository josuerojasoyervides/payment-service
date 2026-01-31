/**
 * Test-only helper: emit WEBHOOK_RECEIVED events in swapped order (older after newer).
 * Use to simulate out-of-order delivery. Provider-agnostic.
 */
import type { WebhookReceivedPayload } from '@app/features/payments/application/adapters/events/flow/payment-flow.events';

export type SendWebhookFn = (payload: WebhookReceivedPayload) => void;

/**
 * Emits WEBHOOK_RECEIVED(evt_old) then WEBHOOK_RECEIVED(evt_new) so that
 * "older" event is sent after "newer" (out-of-order).
 */
export function emitOutOfOrderWebhooks(
  sendWebhook: SendWebhookFn,
  evtNew: WebhookReceivedPayload,
  evtOld: WebhookReceivedPayload,
): void {
  sendWebhook(evtOld);
  sendWebhook(evtNew);
}
