import { TestBed } from '@angular/core/testing';
import { SPECIAL_TOKENS } from '@app/features/payments/infrastructure/fake/shared/constants/special-tokens';
import { FakeIntentStore } from '@app/features/payments/infrastructure/fake/shared/state/fake-intent.store';
import { createOrderId } from '@payments/application/api/testing/vo-test-helpers';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/messages/payment-request.command';

function createRequest(overrides: Partial<CreatePaymentRequest> = {}): CreatePaymentRequest {
  return {
    orderId: createOrderId('order_test'),
    money: { amount: 100, currency: 'MXN' },
    method: { type: 'card', token: 'tok_visa' },
    ...overrides,
  };
}

describe('FakeIntentStore', () => {
  let store: FakeIntentStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [FakeIntentStore] });
    store = TestBed.inject(FakeIntentStore);
    store.reset();
  });

  describe('createIntent', () => {
    it('creates processing intent with remainingRefreshesToSucceed', () => {
      const state = store.createIntent({
        providerId: 'stripe',
        request: createRequest({ method: { type: 'card', token: SPECIAL_TOKENS.PROCESSING } }),
      });
      expect(state.scenarioId).toBe('processing');
      expect(state.currentStatus).toBe('processing');
      expect(state.remainingRefreshesToSucceed).toBe(2);
      expect(state.intentId).toBeTruthy();
      expect(state.stepCount).toBe(0);
    });

    it('creates client_confirm intent with requires_action and nextActionKind', () => {
      const state = store.createIntent({
        providerId: 'stripe',
        request: createRequest({ method: { type: 'card', token: SPECIAL_TOKENS.CLIENT_CONFIRM } }),
      });
      expect(state.scenarioId).toBe('client_confirm');
      expect(state.currentStatus).toBe('requires_action');
      expect(state.nextActionKind).toBe('client_confirm');
      expect(state.clientConfirmed).toBeUndefined();
    });

    it('throws for timeout token (do not store)', () => {
      expect(() =>
        store.createIntent({
          providerId: 'stripe',
          request: createRequest({ method: { type: 'card', token: SPECIAL_TOKENS.TIMEOUT } }),
        }),
      ).toThrow(/cannot create for error behavior "timeout"/);
      expect(store.get('any')).toBeNull();
    });

    it('throws for decline token', () => {
      expect(() =>
        store.createIntent({
          providerId: 'stripe',
          request: createRequest({ method: { type: 'card', token: SPECIAL_TOKENS.DECLINE } }),
        }),
      ).toThrow(/cannot create for error behavior "decline"/);
    });

    it('creates success intent with succeeded status', () => {
      const state = store.createIntent({
        providerId: 'stripe',
        request: createRequest({ method: { type: 'card', token: SPECIAL_TOKENS.SUCCESS } }),
      });
      expect(state.scenarioId).toBe('success');
      expect(state.currentStatus).toBe('succeeded');
    });
  });

  describe('refresh', () => {
    it('processing: transitions processing -> processing -> succeeded after N refreshes', () => {
      const created = store.createIntent({
        providerId: 'stripe',
        request: createRequest({ method: { type: 'card', token: SPECIAL_TOKENS.PROCESSING } }),
      });
      expect(created.remainingRefreshesToSucceed).toBe(2);

      const r1 = store.refresh(created.intentId);
      expect(r1?.currentStatus).toBe('processing');
      expect(r1?.remainingRefreshesToSucceed).toBe(1);
      expect(r1?.stepCount).toBe(1);

      const r2 = store.refresh(created.intentId);
      expect(r2?.currentStatus).toBe('succeeded');
      expect(r2?.remainingRefreshesToSucceed).toBe(0);
      expect(r2?.stepCount).toBe(2);
    });

    it('client_confirm: requires_action -> markClientConfirmed -> refresh -> succeeded', () => {
      const created = store.createIntent({
        providerId: 'stripe',
        request: createRequest({ method: { type: 'card', token: SPECIAL_TOKENS.CLIENT_CONFIRM } }),
      });
      expect(created.currentStatus).toBe('requires_action');

      store.markClientConfirmed(created.intentId);
      const afterRefresh = store.refresh(created.intentId);
      expect(afterRefresh?.currentStatus).toBe('succeeded');
      expect(afterRefresh?.clientConfirmed).toBe(true);
    });

    it('returns null for unknown intentId', () => {
      expect(store.refresh('pi_unknown')).toBeNull();
    });
  });

  describe('markClientConfirmed', () => {
    it('sets clientConfirmed for client_confirm scenario', () => {
      const created = store.createIntent({
        providerId: 'stripe',
        request: createRequest({ method: { type: 'card', token: SPECIAL_TOKENS.CLIENT_CONFIRM } }),
      });
      const updated = store.markClientConfirmed(created.intentId);
      expect(updated?.clientConfirmed).toBe(true);
      expect(updated?.scenarioId).toBe('client_confirm');
    });

    it('returns null for unknown intentId', () => {
      expect(store.markClientConfirmed('pi_unknown')).toBeNull();
    });
  });

  describe('get', () => {
    it('returns state by intentId', () => {
      const created = store.createIntent({
        providerId: 'stripe',
        request: createRequest({ method: { type: 'card', token: SPECIAL_TOKENS.SUCCESS } }),
      });
      const got = store.get(created.intentId);
      expect(got).toEqual(created);
    });

    it('returns null for unknown intentId', () => {
      expect(store.get('pi_unknown')).toBeNull();
    });
  });

  describe('reset', () => {
    it('clears all stored intents', () => {
      const created = store.createIntent({
        providerId: 'stripe',
        request: createRequest({ method: { type: 'card', token: SPECIAL_TOKENS.SUCCESS } }),
      });
      expect(store.get(created.intentId)).toBeTruthy();
      store.reset();
      expect(store.get(created.intentId)).toBeNull();
    });
  });
});
