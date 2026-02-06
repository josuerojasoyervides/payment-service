import type { PaymentIntentStatus } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { ProviderReferences } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider-references.types';
import type { NormalizedWebhookEvent } from '@app/features/payments/domain/subdomains/payment/messages/payment-webhook.event';
import type { WebhookNormalizer } from '@app/features/payments/domain/subdomains/payment/ports/payment-webhook-normalizer/payment-webhook-normalizer.port';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';

/**
 * Minimal PayPal webhook event DTO for Orders/Captures events.
 *
 * Based on:
 * PayPal webhooks docs (events)
 */
export interface PaypalWebhookEvent {
  id: string;
  event_type: string;
  create_time: string; // ISO date
  resource: {
    id: string;
    status?: string;
  };
}

type PaypalWebhookHeaders = Record<string, string | string[]>;

export class PaypalWebhookNormalizer implements WebhookNormalizer<
  PaypalWebhookEvent,
  PaypalWebhookHeaders
> {
  normalize(
    payload: PaypalWebhookEvent,
    headers: PaypalWebhookHeaders,
  ): NormalizedWebhookEvent | null {
    if (!payload || !payload.event_type || !payload.resource?.id) return null;

    // Placeholder for signature verification (PR5.6).
    if (!this.isSignatureValid(payload, headers)) return null;

    // We only care about order/capture events relevant to the payment flow.
    const type = payload.event_type;
    const isOrderEvent = type.startsWith('CHECKOUT.ORDER.');
    const isCaptureEvent = type.startsWith('PAYMENT.CAPTURE.');

    if (!isOrderEvent && !isCaptureEvent) return null;

    const providerRefs: ProviderReferences = {
      [PAYMENT_PROVIDER_IDS.paypal]: {
        orderId: payload.resource.id,
      },
    };

    const status = mapPaypalStatus(payload.resource.status, type);

    const occurredAt = Date.parse(payload.create_time);

    return {
      eventId: payload.id,
      providerId: PAYMENT_PROVIDER_IDS.paypal,
      providerRefs,
      status,
      occurredAt: Number.isNaN(occurredAt) ? Date.now() : occurredAt,
      raw: {
        id: payload.id,
        event_type: payload.event_type,
        resource_status: payload.resource.status,
      },
    };
  }

  private isSignatureValid(_payload: PaypalWebhookEvent, _headers: PaypalWebhookHeaders): boolean {
    // TODO(PR5): verify PayPal signature (backend responsibility).
    return true;
  }
}

function mapPaypalStatus(
  status: string | undefined,
  eventType: string,
): PaymentIntentStatus | undefined {
  if (!status) {
    // Approximate based on event type when status is missing.
    if (eventType.endsWith('.COMPLETED')) return 'succeeded';
    if (eventType.endsWith('.APPROVED')) return 'processing';
    return undefined;
  }

  const upper = status.toUpperCase();

  if (upper === 'COMPLETED' || upper === 'CAPTURED') {
    return 'succeeded';
  }

  if (upper === 'PENDING' || upper === 'APPROVED' || upper === 'SAVED') {
    return 'processing';
  }

  if (upper === 'VOIDED' || upper === 'DENIED') {
    return 'failed';
  }

  return undefined;
}
