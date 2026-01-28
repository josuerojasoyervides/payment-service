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

  it('sends REDIRECT_RETURNED without REFRESH', () => {
    adapter.redirectReturned({
      providerId: 'stripe',
      referenceId: 'pi_123',
    });

    expect(actor.sendSystem).toHaveBeenCalledWith({
      type: 'REDIRECT_RETURNED',
      payload: {
        providerId: 'stripe',
        referenceId: 'pi_123',
      },
    });

    expect(actor.send).not.toHaveBeenCalled();
  });

  it('sends EXTERNAL_STATUS_UPDATED', () => {
    adapter.externalStatusUpdated({
      providerId: 'paypal',
      referenceId: 'ORDER_123',
    });

    expect(actor.sendSystem).toHaveBeenCalledWith({
      type: 'EXTERNAL_STATUS_UPDATED',
      payload: {
        providerId: 'paypal',
        referenceId: 'ORDER_123',
      },
    });
    expect(actor.send).not.toHaveBeenCalled();
  });

  it('always forwards webhook events', () => {
    adapter.webhookReceived({
      providerId: 'stripe',
      referenceId: 'pi_999',
      raw: { id: 'evt_1' },
    });

    expect(actor.sendSystem).toHaveBeenCalledWith({
      type: 'WEBHOOK_RECEIVED',
      payload: {
        providerId: 'stripe',
        referenceId: 'pi_999',
        raw: { id: 'evt_1' },
      },
    });
    expect(actor.send).not.toHaveBeenCalled();
  });
});
