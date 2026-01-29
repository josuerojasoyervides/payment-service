import { inject, Injectable } from '@angular/core';
import { ExternalEventAdapter } from '@payments/application/adapters/events/external-event.adapter';
import type { WebhookReceivedPayload } from '@payments/application/adapters/events/payment-flow.events';
import { WEBHOOK_NORMALIZER_REGISTRY } from '@payments/application/adapters/events/webhook-normalizer-registry.token';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { NormalizedWebhookEvent } from '@payments/domain/subdomains/payment/ports/payment-webhook-normalizer.port';

@Injectable()
export class WebhookIngestionService {
  private readonly externalEvents = inject(ExternalEventAdapter);
  private readonly registry = inject(WEBHOOK_NORMALIZER_REGISTRY);

  /**
   * Entry point for provider webhooks.
   *
   * Application receives raw provider payload + headers (usually in a backend),
   * normalizes them via the configured `WebhookNormalizer`, and feeds the
   * payment flow via `ExternalEventAdapter.webhookReceived`.
   */
  handleWebhook(
    providerId: PaymentProviderId,
    payload: unknown,
    headers: Record<string, unknown> = {},
  ): void {
    const normalizer = this.registry[providerId];
    if (!normalizer) return;

    const event = normalizer.normalize(payload, headers);
    if (!event) return;

    const webhookPayload = this.toWebhookPayload(providerId, event);
    this.externalEvents.webhookReceived(webhookPayload);
  }

  private toWebhookPayload(
    providerId: PaymentProviderId,
    event: NormalizedWebhookEvent,
  ): WebhookReceivedPayload {
    const refsForProvider = event.providerRefs?.[providerId] as
      | {
          paymentId?: string;
          orderId?: string;
          intentId?: string;
          preferenceId?: string;
          [key: string]: string | undefined;
        }
      | undefined;

    const referenceId =
      refsForProvider?.paymentId ??
      refsForProvider?.orderId ??
      refsForProvider?.intentId ??
      refsForProvider?.preferenceId;

    return {
      providerId,
      referenceId: referenceId ?? undefined,
      eventId: event.eventId,
      raw: event.raw,
    };
  }
}
