import type { PaymentIntentStatus } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { ProviderReferences } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider-references.types';
import type { NormalizedWebhookEvent } from '@app/features/payments/domain/subdomains/payment/messages/payment-webhook.event';
import type { WebhookNormalizer } from '@app/features/payments/domain/subdomains/payment/ports/payment-webhook-normalizer/payment-webhook-normalizer.port';
import type {
  StripePaymentIntentDto,
  StripePaymentIntentStatus,
} from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';

/**
 * Minimal Stripe webhook event DTO for PaymentIntent events.
 *
 * This is intentionally narrower than the full Stripe Event type and only
 * models the data we care about for PR5.
 */
export interface StripePaymentIntentWebhookEvent {
  id: string;
  type: string;
  created: number; // epoch seconds
  data: {
    object: StripePaymentIntentDto;
  };
}

type StripeWebhookHeaders = Record<string, string | string[]>;

const STRIPE_PROVIDER_ID: PaymentProviderId = 'stripe';

export class StripeWebhookNormalizer implements WebhookNormalizer<
  StripePaymentIntentWebhookEvent,
  StripeWebhookHeaders
> {
  normalize(
    payload: StripePaymentIntentWebhookEvent,
    _headers: StripeWebhookHeaders,
  ): NormalizedWebhookEvent | null {
    if (!payload || !payload.type || !payload.data?.object) return null;

    // We only care about PaymentIntent events for PR5.
    if (!payload.type.startsWith('payment_intent.')) return null;

    const object = payload.data.object;
    if (object.object !== 'payment_intent') return null;

    const providerRefs: ProviderReferences = {
      [STRIPE_PROVIDER_ID]: {
        intentId: object.id,
      },
    };

    const status = mapStripeStatus(object.status);

    const occurredAtMs = payload.created * 1000;

    return {
      eventId: payload.id,
      providerId: STRIPE_PROVIDER_ID,
      providerRefs,
      status,
      occurredAt: occurredAtMs,
      raw: {
        id: payload.id,
        type: payload.type,
        created: payload.created,
      },
    };
  }
}

function mapStripeStatus(status: StripePaymentIntentStatus): PaymentIntentStatus {
  switch (status) {
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
    case 'processing':
    case 'canceled':
    case 'succeeded':
      return status;
    case 'requires_capture':
      // For our domain, "requires_capture" is effectively still processing.
      return 'processing';
    default:
      // Future-proof: fallback to processing for unknown intermediate statuses.
      return 'processing';
  }
}
