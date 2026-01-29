import { TestBed } from '@angular/core/testing';
import { ExternalEventAdapter } from '@payments/application/adapters/events/external-event.adapter';
import { WebhookIngestionService } from '@payments/application/adapters/events/webhook-ingestion.service';
import {
  WEBHOOK_NORMALIZER_REGISTRY,
  type WebhookNormalizerRegistry,
} from '@payments/application/adapters/events/webhook-normalizer-registry.token';
import { createPaymentFlowMachine } from '@payments/application/orchestration/flow/payment-flow.machine';
import type {
  PaymentFlowActorRef,
  PaymentFlowMachineContext,
  PaymentFlowSnapshot,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';
import type { PaymentFlowConfigOverrides } from '@payments/application/orchestration/flow/payment-flow/policy/payment-flow.policy';
import type { PaymentFlowContext } from '@payments/domain/subdomains/payment/contracts/payment-flow-context.types';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import type { NormalizedWebhookEvent } from '@payments/domain/subdomains/payment/ports/payment-webhook-normalizer.port';
import {
  type StripePaymentIntentWebhookEvent,
  StripeWebhookNormalizer,
} from '@payments/infrastructure/stripe/workflows/webhook/stripe-webhook.normalizer';
import { createActor } from 'xstate';

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

describe('WebhookIngestionService integration with PaymentFlowMachine', () => {
  const baseIntent: PaymentIntent = {
    id: 'pi_webhook',
    provider: 'stripe',
    status: 'processing',
    amount: 100,
    currency: 'MXN',
  };

  const config: PaymentFlowConfigOverrides = {
    polling: { baseDelayMs: 100000, maxDelayMs: 100000, maxAttempts: 99 },
    statusRetry: { baseDelayMs: 1, maxDelayMs: 1, maxRetries: 0 },
  };

  const waitForSnapshot = (
    actor: PaymentFlowActorRef,
    predicate: (snap: PaymentFlowSnapshot) => boolean,
    timeoutMs = 500,
  ): Promise<PaymentFlowSnapshot> => {
    const current = actor.getSnapshot() as PaymentFlowSnapshot;
    if (predicate(current)) return Promise.resolve(current);

    return new Promise<PaymentFlowSnapshot>((resolve, reject) => {
      let sub: { unsubscribe: () => void } | null = null;

      const timeout = setTimeout(() => {
        sub?.unsubscribe();
        reject(new Error(`Timeout waiting for snapshot state: ${actor.getSnapshot().value}`));
      }, timeoutMs);

      sub = actor.subscribe((snap) => {
        if (predicate(snap as PaymentFlowSnapshot)) {
          clearTimeout(timeout);
          sub?.unsubscribe();
          resolve(snap as PaymentFlowSnapshot);
        }
      });
    });
  };

  it('drives the flow to done when a Stripe payment_intent.succeeded webhook is ingested', async () => {
    const deps = {
      startPayment: vi.fn(async () => baseIntent),
      confirmPayment: vi.fn(async () => baseIntent),
      cancelPayment: vi.fn(async () => ({ ...baseIntent, status: 'canceled' as const })),
      getStatus: vi.fn(async () => ({
        ...baseIntent,
        id: 'pi_webhook',
        status: 'succeeded' as const,
      })),
      clientConfirm: vi.fn(async () => baseIntent),
      finalize: vi.fn(async () => baseIntent),
    };

    const initialContext: Partial<PaymentFlowMachineContext> = {
      flowContext: {
        flowId: 'flow_webhook_e2e',
        providerId: 'stripe',
        providerRefs: { stripe: { intentId: 'pi_webhook' } },
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      } satisfies PaymentFlowContext,
      providerId: 'stripe',
      intentId: null,
    };

    const machine = createPaymentFlowMachine(deps, config, initialContext);
    const actor = createActor(machine) as PaymentFlowActorRef;
    actor.start();

    const externalEvents = {
      webhookReceived: vi.fn((payload: any) => {
        actor.send({ type: 'WEBHOOK_RECEIVED', payload });
      }),
    };

    const registry: WebhookNormalizerRegistry = {
      stripe: new StripeWebhookNormalizer(),
    };

    TestBed.configureTestingModule({
      providers: [
        WebhookIngestionService,
        { provide: ExternalEventAdapter, useValue: externalEvents },
        { provide: WEBHOOK_NORMALIZER_REGISTRY, useValue: registry },
      ],
    });

    const service = TestBed.inject(WebhookIngestionService);

    const payload: StripePaymentIntentWebhookEvent = {
      id: 'evt_webhook_1',
      type: 'payment_intent.succeeded',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'pi_webhook',
          object: 'payment_intent',
          amount: 100,
          amount_received: 100,
          currency: 'mxn',
          status: 'succeeded',
          client_secret: 'secret_webhook',
          created: Math.floor(Date.now() / 1000),
          livemode: false,
          payment_method_types: ['card'],
          capture_method: 'automatic',
          confirmation_method: 'automatic',
        },
      },
    };

    service.handleWebhook('stripe', payload, {});

    const snap = await waitForSnapshot(actor, (s) => s.value === 'done', 1500);

    expect(snap.hasTag('ready')).toBe(true);
    expect(snap.context.intent?.status).toBe('succeeded');
    expect(deps.getStatus).toHaveBeenCalledTimes(1);
  });
});
