import type { StripePaymentIntentDto } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import type { NormalizedWebhookEvent } from '@payments/domain/subdomains/payment/messages/payment-webhook.event';
import {
  type StripePaymentIntentWebhookEvent,
  StripeWebhookNormalizer,
} from '@payments/infrastructure/stripe/workflows/webhook/stripe-webhook.normalizer';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';

describe('StripeWebhookNormalizer', () => {
  let normalizer: StripeWebhookNormalizer;

  beforeEach(() => {
    normalizer = new StripeWebhookNormalizer();
  });

  function buildPaymentIntent(
    overrides: Partial<StripePaymentIntentDto> = {},
  ): StripePaymentIntentDto {
    return {
      id: 'pi_123',
      object: 'payment_intent',
      amount: 100,
      amount_received: 100,
      currency: 'mxn',
      status: 'succeeded',
      client_secret: 'secret_123',
      created: 1_700_000_000,
      livemode: false,
      payment_method_types: ['card'],
      capture_method: 'automatic',
      confirmation_method: 'automatic',
      ...overrides,
    };
  }

  it('normalizes payment_intent.succeeded events into a NormalizedWebhookEvent', () => {
    const payload: StripePaymentIntentWebhookEvent = {
      id: 'evt_1',
      type: 'payment_intent.succeeded',
      created: 1_700_000_001,
      data: {
        object: buildPaymentIntent({ id: 'pi_success', status: 'succeeded' }),
      },
    };

    const result = normalizer.normalize(payload, {});

    expect(result).not.toBeNull();
    const event = result as NormalizedWebhookEvent;

    expect(event.eventId).toBe('evt_1');
    expect(event.providerId).toBe(PAYMENT_PROVIDER_IDS.stripe);
    expect(event.providerRefs?.[PAYMENT_PROVIDER_IDS.stripe]?.intentId).toBe('pi_success');
    expect(event.status).toBe('succeeded');
    expect(event.occurredAt).toBe(1_700_000_001 * 1000);
  });

  it('returns null for non-payment_intent events', () => {
    const payload: StripePaymentIntentWebhookEvent = {
      id: 'evt_2',
      type: 'charge.refunded',
      created: 1_700_000_002,
      data: {
        object: buildPaymentIntent({ id: 'pi_other', status: 'processing' }),
      },
    };

    const result = normalizer.normalize(payload, {});
    expect(result).toBeNull();
  });

  it('returns null for invalid payloads', () => {
    const result = normalizer.normalize({} as StripePaymentIntentWebhookEvent, {});
    expect(result).toBeNull();
  });
});
