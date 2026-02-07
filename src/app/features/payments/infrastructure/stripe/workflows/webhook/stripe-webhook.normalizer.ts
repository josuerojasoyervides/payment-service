import type { PaymentIntentStatus } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { ProviderReferences } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider-references.types';
import type { NormalizedWebhookEvent } from '@app/features/payments/domain/subdomains/payment/messages/payment-webhook.event';
import type { WebhookNormalizer } from '@app/features/payments/domain/subdomains/payment/ports/payment-webhook-normalizer/payment-webhook-normalizer.port';
import type { StripePaymentIntentStatus } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { StripePaymentIntentSchema } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';
import { match } from 'ts-pattern';
import { z } from 'zod';

/**
 * Minimal Stripe webhook event DTO for PaymentIntent events.
 *
 * This is intentionally narrower than the full Stripe Event type and only
 * models the data we care about for PR5.
 */
export const StripePaymentIntentWebhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  created: z.number(), // epoch seconds
  data: z.object({
    object: StripePaymentIntentSchema,
  }),
});
export type StripePaymentIntentWebhookEvent = z.infer<typeof StripePaymentIntentWebhookEventSchema>;

type StripeWebhookHeaders = Record<string, string | string[]>;

export class StripeWebhookNormalizer implements WebhookNormalizer<
  StripePaymentIntentWebhookEvent,
  StripeWebhookHeaders
> {
  normalize(
    payload: StripePaymentIntentWebhookEvent,
    headers: StripeWebhookHeaders,
  ): NormalizedWebhookEvent | null {
    const parsed = StripePaymentIntentWebhookEventSchema.safeParse(payload);
    if (!parsed.success) return null;
    const event = parsed.data;

    // Placeholder for signature verification (PR5.6).
    if (!this.isSignatureValid(event, headers)) return null;

    // We only care about PaymentIntent events for PR5.
    if (!event.type.startsWith('payment_intent.')) return null;

    const object = event.data.object;
    if (object.object !== 'payment_intent') return null;

    const providerRefs: ProviderReferences = {
      [PAYMENT_PROVIDER_IDS.stripe]: {
        intentId: object.id,
      },
    };

    const status = mapStripeStatus(object.status);

    const occurredAtMs = event.created * 1000;

    return {
      eventId: event.id,
      providerId: PAYMENT_PROVIDER_IDS.stripe,
      providerRefs,
      status,
      occurredAt: occurredAtMs,
      raw: {
        id: event.id,
        type: event.type,
        created: event.created,
      },
    };
  }

  private isSignatureValid(
    _payload: StripePaymentIntentWebhookEvent,
    _headers: StripeWebhookHeaders,
  ): boolean {
    // Signature verification is handled by the backend webhook endpoint.
    return true;
  }
}

function mapStripeStatus(status: StripePaymentIntentStatus): PaymentIntentStatus {
  return match(status)
    .returnType<PaymentIntentStatus>()
    .with('requires_payment_method', () => 'requires_payment_method')
    .with('requires_confirmation', () => 'requires_confirmation')
    .with('requires_action', () => 'requires_action')
    .with('processing', () => 'processing')
    .with('canceled', () => 'canceled')
    .with('succeeded', () => 'succeeded')
    .with('requires_capture', () => 'processing')
    .otherwise(() => 'processing');
}
