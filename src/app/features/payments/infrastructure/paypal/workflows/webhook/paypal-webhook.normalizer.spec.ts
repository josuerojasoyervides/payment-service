import type { NormalizedWebhookEvent } from '@payments/domain/subdomains/payment/messages/payment-webhook.event';
import {
  type PaypalWebhookEvent,
  PaypalWebhookNormalizer,
} from '@payments/infrastructure/paypal/workflows/webhook/paypal-webhook.normalizer';

describe('PaypalWebhookNormalizer', () => {
  let normalizer: PaypalWebhookNormalizer;

  beforeEach(() => {
    normalizer = new PaypalWebhookNormalizer();
  });

  it('normalizes CHECKOUT.ORDER.APPROVED events as processing', () => {
    const payload: PaypalWebhookEvent = {
      id: 'WH-ORDER-1',
      event_type: 'CHECKOUT.ORDER.APPROVED',
      create_time: '2026-01-29T00:00:00Z',
      resource: {
        id: 'ORDER_123',
        status: 'APPROVED',
      },
    };

    const result = normalizer.normalize(payload, {});

    expect(result).not.toBeNull();
    const event = result as NormalizedWebhookEvent;

    expect(event.eventId).toBe('WH-ORDER-1');
    expect(event.providerId).toBe('paypal');
    expect(event.providerRefs?.['paypal']?.orderId).toBe('ORDER_123');
    expect(event.status).toBe('processing');
  });

  it('normalizes PAYMENT.CAPTURE.COMPLETED events as succeeded', () => {
    const payload: PaypalWebhookEvent = {
      id: 'WH-CAPTURE-1',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      create_time: '2026-01-29T00:00:01Z',
      resource: {
        id: 'ORDER_456',
        status: 'COMPLETED',
      },
    };

    const result = normalizer.normalize(payload, {});

    expect(result).not.toBeNull();
    const event = result as NormalizedWebhookEvent;

    expect(event.eventId).toBe('WH-CAPTURE-1');
    expect(event.providerId).toBe('paypal');
    expect(event.providerRefs?.['paypal']?.orderId).toBe('ORDER_456');
    expect(event.status).toBe('succeeded');
  });

  it('returns null for unrelated event types', () => {
    const payload: PaypalWebhookEvent = {
      id: 'WH-IGNORED-1',
      event_type: 'BILLING.SUBSCRIPTION.CANCELLED',
      create_time: '2026-01-29T00:00:02Z',
      resource: {
        id: 'SUB_1',
      },
    };

    const result = normalizer.normalize(payload, {});
    expect(result).toBeNull();
  });
});
