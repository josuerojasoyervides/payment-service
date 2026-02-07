import type { PaymentIntentStatus } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { ProviderReferences } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider-references.types';
import type { NormalizedWebhookEvent } from '@app/features/payments/domain/subdomains/payment/messages/payment-webhook.event';
import type { WebhookNormalizer } from '@app/features/payments/domain/subdomains/payment/ports/payment-webhook-normalizer/payment-webhook-normalizer.port';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import { match } from 'ts-pattern';
import { z } from 'zod';

/**
 * Minimal PayPal webhook event DTO for Orders/Captures events.
 *
 * Based on:
 * PayPal webhooks docs (events)
 */
export const PaypalWebhookEventSchema = z.object({
  id: z.string(),
  event_type: z.string(),
  create_time: z.string().datetime({ offset: true }),
  resource: z.object({
    id: z.string(),
    status: z.string().optional(),
  }),
});
export type PaypalWebhookEvent = z.infer<typeof PaypalWebhookEventSchema>;

type PaypalWebhookHeaders = Record<string, string | string[]>;

export class PaypalWebhookNormalizer implements WebhookNormalizer<
  PaypalWebhookEvent,
  PaypalWebhookHeaders
> {
  normalize(
    payload: PaypalWebhookEvent,
    headers: PaypalWebhookHeaders,
  ): NormalizedWebhookEvent | null {
    const parsed = PaypalWebhookEventSchema.safeParse(payload);
    if (!parsed.success) return null;
    const event = parsed.data;

    // Placeholder for signature verification (PR5.6).
    if (!this.isSignatureValid(event, headers)) return null;

    // We only care about order/capture events relevant to the payment flow.
    const type = event.event_type;
    const isOrderEvent = type.startsWith('CHECKOUT.ORDER.');
    const isCaptureEvent = type.startsWith('PAYMENT.CAPTURE.');

    if (!isOrderEvent && !isCaptureEvent) return null;

    const providerRefs: ProviderReferences = {
      [PAYMENT_PROVIDER_IDS.paypal]: {
        orderId: event.resource.id,
      },
    };

    const status = mapPaypalStatus(event.resource.status, type);

    const occurredAt = parseWebhookTimestamp(event.create_time);

    return {
      eventId: event.id,
      providerId: PAYMENT_PROVIDER_IDS.paypal,
      providerRefs,
      status,
      occurredAt,
      raw: {
        id: event.id,
        event_type: event.event_type,
        resource_status: event.resource.status,
      },
    };
  }

  private isSignatureValid(_payload: PaypalWebhookEvent, _headers: PaypalWebhookHeaders): boolean {
    // Signature verification is handled by the backend webhook endpoint.
    return true;
  }
}

function mapPaypalStatus(
  status: string | undefined,
  eventType: string,
): PaymentIntentStatus | undefined {
  const normalized = status?.toUpperCase();

  if (!normalized) {
    return match(eventType)
      .returnType<PaymentIntentStatus | undefined>()
      .when(
        (type) => type.endsWith('.COMPLETED'),
        () => 'succeeded',
      )
      .when(
        (type) => type.endsWith('.APPROVED'),
        () => 'processing',
      )
      .otherwise(() => undefined);
  }

  return match(normalized)
    .returnType<PaymentIntentStatus | undefined>()
    .with('COMPLETED', 'CAPTURED', () => 'succeeded')
    .with('PENDING', 'APPROVED', 'SAVED', () => 'processing')
    .with('VOIDED', 'DENIED', () => 'failed')
    .otherwise(() => undefined);
}

function parseWebhookTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}
