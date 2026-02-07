import { SPEI_RAW_KEYS } from '@app/features/payments/infrastructure/stripe/shared/constants/raw-keys.constants';
import { createOrderId } from '@payments/application/api/testing/vo-test-helpers';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/messages/payment-request.command';
import { createFakeSpeiSource } from '@payments/infrastructure/fake/shared/helpers/create-fake-spei-source.helper';

describe('createFakeSpeiSource', () => {
  it('includes bank code and clabe in fake SPEI source', () => {
    const req: CreatePaymentRequest = {
      orderId: createOrderId('order_spei_1'),
      money: { amount: 100, currency: 'MXN' },
      method: { type: 'spei' },
      idempotencyKey: 'idem_fake_spei',
    };

    const dto = createFakeSpeiSource(req);

    expect(dto.spei[SPEI_RAW_KEYS.BANK]).toBeTruthy();
    expect(dto.spei[SPEI_RAW_KEYS.CLABE]).toBeTruthy();
  });
});
