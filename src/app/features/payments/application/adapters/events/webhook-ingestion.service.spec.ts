import { TestBed } from '@angular/core/testing';
import { ExternalEventAdapter } from '@payments/application/adapters/events/external-event.adapter';
import { WebhookIngestionService } from '@payments/application/adapters/events/webhook-ingestion.service';
import {
  WEBHOOK_NORMALIZER_REGISTRY,
  type WebhookNormalizerRegistry,
} from '@payments/application/adapters/events/webhook-normalizer-registry.token';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { NormalizedWebhookEvent } from '@payments/domain/subdomains/payment/ports/payment-webhook-normalizer.port';

describe('WebhookIngestionService', () => {
  let service: WebhookIngestionService;
  let externalEvents: { webhookReceived: ReturnType<typeof vi.fn> };

  function createEvent(partial: Partial<NormalizedWebhookEvent> = {}): NormalizedWebhookEvent {
    return {
      eventId: 'evt_1',
      providerId: 'stripe',
      providerRefs: {
        stripe: { intentId: 'pi_123' },
      },
      occurredAt: Date.now(),
      ...partial,
    };
  }

  beforeEach(() => {
    externalEvents = {
      webhookReceived: vi.fn(),
    };

    const registry: WebhookNormalizerRegistry = {
      stripe: {
        normalize: vi.fn().mockReturnValue(
          createEvent({
            eventId: 'evt_stripe_1',
            providerRefs: {
              stripe: { intentId: 'pi_123' },
            },
          }),
        ),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        WebhookIngestionService,
        { provide: ExternalEventAdapter, useValue: externalEvents },
        { provide: WEBHOOK_NORMALIZER_REGISTRY, useValue: registry },
      ],
    });

    service = TestBed.inject(WebhookIngestionService);
  });

  it('uses registry normalizer and forwards WEBHOOK_RECEIVED to ExternalEventAdapter', () => {
    service.handleWebhook('stripe', { any: 'payload' }, { 'stripe-signature': 'sig' });

    expect(externalEvents.webhookReceived).toHaveBeenCalledTimes(1);
    expect(externalEvents.webhookReceived).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'stripe',
        referenceId: 'pi_123',
        eventId: 'evt_stripe_1',
      }),
    );
  });

  it('does nothing when no normalizer is registered for provider', () => {
    service.handleWebhook('paypal' as PaymentProviderId, { any: 'payload' }, {});

    expect(externalEvents.webhookReceived).not.toHaveBeenCalled();
  });
});
