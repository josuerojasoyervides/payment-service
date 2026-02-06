import { SPECIAL_TOKENS } from '@app/features/payments/infrastructure/fake/shared/constants/special-tokens';
import {
  createFakeIntentState,
  getFakeIntentState,
  markFakeIntentClientConfirmed,
  refreshFakeIntentState,
  resetFakeIntentState,
} from '@app/features/payments/infrastructure/fake/shared/state/fake-intent.state';
import { createOrderId } from '@payments/application/api/testing/vo-test-helpers';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/messages/payment-request.command';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';

function createRequest(overrides: Partial<CreatePaymentRequest> = {}): CreatePaymentRequest {
  return {
    orderId: createOrderId('order_test'),
    money: { amount: 100, currency: 'MXN' },
    method: { type: 'card', token: 'tok_visa' },
    idempotencyKey: 'idem_fake_state',
    ...overrides,
  };
}

describe('fake-intent.state', () => {
  beforeEach(() => {
    resetFakeIntentState();
  });

  describe('createFakeIntentState', () => {
    it('creates processing intent with remainingRefreshesToSucceed', () => {
      const state = createFakeIntentState({
        providerId: PAYMENT_PROVIDER_IDS.stripe,
        request: createRequest({ method: { type: 'card', token: SPECIAL_TOKENS.PROCESSING } }),
      });
      expect(state.scenarioId).toBe('processing');
      expect(state.currentStatus).toBe('processing');
      expect(state.remainingRefreshesToSucceed).toBe(2);
      expect(state.intentId).toBeTruthy();
      expect(state.stepCount).toBe(0);
    });

    it('creates client_confirm intent with requires_action and nextActionKind', () => {
      const state = createFakeIntentState({
        providerId: PAYMENT_PROVIDER_IDS.stripe,
        request: createRequest({ method: { type: 'card', token: SPECIAL_TOKENS.CLIENT_CONFIRM } }),
      });
      expect(state.scenarioId).toBe('client_confirm');
      expect(state.currentStatus).toBe('requires_action');
      expect(state.nextActionKind).toBe('client_confirm');
      expect(state.clientConfirmed).toBeUndefined();
    });

    it('throws for timeout token (do not store)', () => {
      expect(() =>
        createFakeIntentState({
          providerId: PAYMENT_PROVIDER_IDS.stripe,
          request: createRequest({ method: { type: 'card', token: SPECIAL_TOKENS.TIMEOUT } }),
        }),
      ).toThrow(/cannot create for error behavior "timeout"/);
      expect(getFakeIntentState('any')).toBeNull();
    });

    it('throws for decline token', () => {
      expect(() =>
        createFakeIntentState({
          providerId: PAYMENT_PROVIDER_IDS.stripe,
          request: createRequest({ method: { type: 'card', token: SPECIAL_TOKENS.DECLINE } }),
        }),
      ).toThrow(/cannot create for error behavior "decline"/);
    });

    it('creates success intent with succeeded status', () => {
      const state = createFakeIntentState({
        providerId: PAYMENT_PROVIDER_IDS.stripe,
        request: createRequest({ method: { type: 'card', token: SPECIAL_TOKENS.SUCCESS } }),
      });
      expect(state.scenarioId).toBe('success');
      expect(state.currentStatus).toBe('succeeded');
    });
  });

  describe('refreshFakeIntentState', () => {
    it('processing: transitions processing -> processing -> succeeded after N refreshes', () => {
      const created = createFakeIntentState({
        providerId: PAYMENT_PROVIDER_IDS.stripe,
        request: createRequest({ method: { type: 'card', token: SPECIAL_TOKENS.PROCESSING } }),
      });
      expect(created.remainingRefreshesToSucceed).toBe(2);

      const r1 = refreshFakeIntentState(created.intentId);
      expect(r1?.currentStatus).toBe('processing');
      expect(r1?.remainingRefreshesToSucceed).toBe(1);
      expect(r1?.stepCount).toBe(1);

      const r2 = refreshFakeIntentState(created.intentId);
      expect(r2?.currentStatus).toBe('succeeded');
      expect(r2?.remainingRefreshesToSucceed).toBe(0);
      expect(r2?.stepCount).toBe(2);
    });

    it('client_confirm: requires_action -> markClientConfirmed -> refresh -> succeeded', () => {
      const created = createFakeIntentState({
        providerId: PAYMENT_PROVIDER_IDS.stripe,
        request: createRequest({ method: { type: 'card', token: SPECIAL_TOKENS.CLIENT_CONFIRM } }),
      });
      expect(created.currentStatus).toBe('requires_action');

      markFakeIntentClientConfirmed(created.intentId);
      const afterRefresh = refreshFakeIntentState(created.intentId);
      expect(afterRefresh?.currentStatus).toBe('succeeded');
      expect(afterRefresh?.clientConfirmed).toBe(true);
    });

    it('returns null for unknown intentId', () => {
      expect(refreshFakeIntentState('pi_unknown')).toBeNull();
    });
  });

  describe('markFakeIntentClientConfirmed', () => {
    it('sets clientConfirmed for client_confirm scenario', () => {
      const created = createFakeIntentState({
        providerId: PAYMENT_PROVIDER_IDS.stripe,
        request: createRequest({ method: { type: 'card', token: SPECIAL_TOKENS.CLIENT_CONFIRM } }),
      });
      const updated = markFakeIntentClientConfirmed(created.intentId);
      expect(updated?.clientConfirmed).toBe(true);
      expect(updated?.scenarioId).toBe('client_confirm');
    });

    it('returns null for unknown intentId', () => {
      expect(markFakeIntentClientConfirmed('pi_unknown')).toBeNull();
    });
  });

  describe('getFakeIntentState', () => {
    it('returns state by intentId', () => {
      const created = createFakeIntentState({
        providerId: PAYMENT_PROVIDER_IDS.stripe,
        request: createRequest({ method: { type: 'card', token: SPECIAL_TOKENS.SUCCESS } }),
      });
      const got = getFakeIntentState(created.intentId);
      expect(got).toEqual(created);
    });

    it('returns null for unknown intentId', () => {
      expect(getFakeIntentState('pi_unknown')).toBeNull();
    });
  });

  describe('resetFakeIntentState', () => {
    it('clears all stored intents', () => {
      const created = createFakeIntentState({
        providerId: PAYMENT_PROVIDER_IDS.stripe,
        request: createRequest({ method: { type: 'card', token: SPECIAL_TOKENS.SUCCESS } }),
      });
      expect(getFakeIntentState(created.intentId)).toBeTruthy();
      resetFakeIntentState();
      expect(getFakeIntentState(created.intentId)).toBeNull();
    });
  });
});
