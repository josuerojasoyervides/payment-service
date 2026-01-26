import { TestBed } from '@angular/core/testing';

import { PaymentFlowActorService } from '../orchestration/flow/payment-flow.actor.service';
import { ExternalEventAdapter } from './external-event.adapter';

describe('ExternalEventAdapter', () => {
  let adapter: ExternalEventAdapter;
  let actor: { sendSystem: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    actor = {
      sendSystem: vi.fn(),
      send: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [ExternalEventAdapter, { provide: PaymentFlowActorService, useValue: actor }],
    });

    adapter = TestBed.inject(ExternalEventAdapter);
  });

  it('sends PROVIDER_UPDATE and REFRESH by default', () => {
    adapter.providerUpdate({
      providerId: 'stripe',
      referenceId: 'pi_123',
      status: 'succeeded',
      raw: {},
    });

    expect(actor.sendSystem).toHaveBeenCalledWith({
      type: 'PROVIDER_UPDATE',
      payload: {
        providerId: 'stripe',
        referenceId: 'pi_123',
        status: 'succeeded',
        raw: {},
      },
    });

    expect(actor.send).toHaveBeenCalledWith({
      type: 'REFRESH',
      providerId: 'stripe',
      intentId: 'pi_123',
    });
  });

  it('skips REFRESH when refresh option is false', () => {
    adapter.providerUpdate(
      {
        providerId: 'paypal',
        referenceId: 'ORDER_123',
        raw: {},
      },
      { refresh: false },
    );

    expect(actor.sendSystem).toHaveBeenCalledWith({
      type: 'PROVIDER_UPDATE',
      payload: {
        providerId: 'paypal',
        referenceId: 'ORDER_123',
        raw: {},
      },
    });

    expect(actor.send).not.toHaveBeenCalled();
  });

  it('always forwards webhook events', () => {
    adapter.webhookReceived({
      providerId: 'stripe',
      referenceId: 'pi_999',
      eventType: 'payment_intent.succeeded',
      raw: { id: 'evt_1' },
    });

    expect(actor.sendSystem).toHaveBeenCalledWith({
      type: 'WEBHOOK_RECEIVED',
      payload: {
        providerId: 'stripe',
        referenceId: 'pi_999',
        eventType: 'payment_intent.succeeded',
        raw: { id: 'evt_1' },
      },
    });
  });

  it('forwards validation failures and status confirmations', () => {
    adapter.validationFailed({
      stage: 'INITIATE',
      reason: 'missing token',
      raw: { field: 'token' },
    });

    adapter.statusConfirmed({
      providerId: 'stripe',
      referenceId: 'pi_888',
      status: 'succeeded',
      raw: {},
    });

    expect(actor.sendSystem).toHaveBeenCalledWith({
      type: 'VALIDATION_FAILED',
      payload: {
        stage: 'INITIATE',
        reason: 'missing token',
        raw: { field: 'token' },
      },
    });

    expect(actor.sendSystem).toHaveBeenCalledWith({
      type: 'STATUS_CONFIRMED',
      payload: {
        providerId: 'stripe',
        referenceId: 'pi_888',
        status: 'succeeded',
        raw: {},
      },
    });
  });
});
