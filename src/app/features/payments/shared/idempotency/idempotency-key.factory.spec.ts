import { TestBed } from '@angular/core/testing';
import {
  createOrderId,
  createPaymentIntentId,
} from '@payments/application/api/testing/vo-test-helpers';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/messages/payment-request.command';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';

describe('IdempotencyKeyFactory', () => {
  let factory: IdempotencyKeyFactory;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [IdempotencyKeyFactory],
    });
    factory = TestBed.inject(IdempotencyKeyFactory);
  });

  describe('generateForStart', () => {
    const req: CreatePaymentRequest = {
      orderId: createOrderId('o1'),
      money: { amount: 100, currency: 'MXN' },
      method: { type: 'card', token: 'tok_123' },
    };

    it('generates stable key for same request', () => {
      const key1 = factory.generateForStart('stripe', req);
      const key2 = factory.generateForStart('stripe', req);

      expect(key1).toBe(key2);
      expect(key1).toBe('stripe:start:o1:100:MXN:card');
    });

    it('generates different key for different provider', () => {
      const key1 = factory.generateForStart('stripe', req);
      const key2 = factory.generateForStart('paypal', req);

      expect(key1).not.toBe(key2);
      expect(key1).toBe('stripe:start:o1:100:MXN:card');
      expect(key2).toBe('paypal:start:o1:100:MXN:card');
    });

    it('generates different key for different orderId', () => {
      const req2 = { ...req, orderId: createOrderId('o2') };
      const key1 = factory.generateForStart('stripe', req);
      const key2 = factory.generateForStart('stripe', req2);

      expect(key1).not.toBe(key2);
      expect(key1).toBe('stripe:start:o1:100:MXN:card');
      expect(key2).toBe('stripe:start:o2:100:MXN:card');
    });

    it('generates different key for different amount', () => {
      const req2 = { ...req, money: { amount: 200, currency: 'MXN' as const } };
      const key1 = factory.generateForStart('stripe', req);
      const key2 = factory.generateForStart('stripe', req2);

      expect(key1).not.toBe(key2);
      expect(key1).toBe('stripe:start:o1:100:MXN:card');
      expect(key2).toBe('stripe:start:o1:200:MXN:card');
    });

    it('generates different key for different currency', () => {
      const req2 = { ...req, money: { amount: 100, currency: 'USD' as const } };
      const key1 = factory.generateForStart('stripe', req);
      const key2 = factory.generateForStart('stripe', req2);

      expect(key1).not.toBe(key2);
      expect(key1).toBe('stripe:start:o1:100:MXN:card');
      expect(key2).toBe('stripe:start:o1:100:USD:card');
    });

    it('generates different key for different method type', () => {
      const req2 = { ...req, method: { type: 'spei' as const } };
      const key1 = factory.generateForStart('stripe', req);
      const key2 = factory.generateForStart('stripe', req2);

      expect(key1).not.toBe(key2);
      expect(key1).toBe('stripe:start:o1:100:MXN:card');
      expect(key2).toBe('stripe:start:o1:100:MXN:spei');
    });
  });

  describe('generateForConfirm', () => {
    it('generates stable key for same intentId', () => {
      const key1 = factory.generateForConfirm('stripe', createPaymentIntentId('pi_1'));
      const key2 = factory.generateForConfirm('stripe', createPaymentIntentId('pi_1'));

      expect(key1).toBe(key2);
      expect(key1).toBe('stripe:confirm:pi_1');
    });

    it('generates different key for different provider', () => {
      const key1 = factory.generateForConfirm('stripe', createPaymentIntentId('pi_1'));
      const key2 = factory.generateForConfirm('paypal', createPaymentIntentId('pi_1'));

      expect(key1).not.toBe(key2);
      expect(key1).toBe('stripe:confirm:pi_1');
      expect(key2).toBe('paypal:confirm:pi_1');
    });
  });

  describe('generateForCancel', () => {
    it('generates stable key for same intentId', () => {
      const key1 = factory.generateForCancel('stripe', createPaymentIntentId('pi_1'));
      const key2 = factory.generateForCancel('stripe', createPaymentIntentId('pi_1'));

      expect(key1).toBe(key2);
      expect(key1).toBe('stripe:cancel:pi_1');
    });
  });

  describe('generateForGet', () => {
    it('generates stable key for same intentId', () => {
      const key1 = factory.generateForGet('stripe', createPaymentIntentId('pi_1'));
      const key2 = factory.generateForGet('stripe', createPaymentIntentId('pi_1'));

      expect(key1).toBe(key2);
      expect(key1).toBe('stripe:get:pi_1');
    });
  });

  describe('generate', () => {
    it('generates correct key for start operation', () => {
      const req: CreatePaymentRequest = {
        orderId: createOrderId('o1'),
        money: { amount: 100, currency: 'MXN' },
        method: { type: 'card' },
      };

      const key = factory.generate('stripe', { operation: 'start', req });
      expect(key).toBe('stripe:start:o1:100:MXN:card');
    });

    it('generates correct key for confirm operation', () => {
      const key = factory.generate('stripe', {
        operation: 'confirm',
        req: { intentId: createPaymentIntentId('pi_1') },
      });
      expect(key).toBe('stripe:confirm:pi_1');
    });

    it('generates correct key for cancel operation', () => {
      const key = factory.generate('stripe', {
        operation: 'cancel',
        req: { intentId: createPaymentIntentId('pi_1') },
      });
      expect(key).toBe('stripe:cancel:pi_1');
    });

    it('generates correct key for get operation', () => {
      const key = factory.generate('stripe', {
        operation: 'get',
        req: { intentId: createPaymentIntentId('pi_1') },
      });
      expect(key).toBe('stripe:get:pi_1');
    });
  });

  describe('generateForFlowOperation', () => {
    it('generates key as flowId:operation:attempt', () => {
      const key = factory.generateForFlowOperation(
        {
          flowId: 'flow_123',
          providerId: 'stripe',
          externalReference: 'order_1',
        },
        'start',
        0,
      );

      expect(key).toBe('flow_123:start:0');
    });

    it('falls back to unknown_flow when flowId is missing', () => {
      const key = factory.generateForFlowOperation(
        {
          providerId: 'stripe',
          externalReference: 'order_1',
        } as any,
        'get',
        2,
      );

      expect(key).toBe('unknown_flow:get:2');
    });
  });
});
