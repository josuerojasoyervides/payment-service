import type { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { generateId } from '@payments/infrastructure/fake/helpers/get-id.helper';
import { hashString } from '@payments/infrastructure/fake/helpers/hash-string.helper';
import type { StripeSpeiSourceDto } from '@payments/infrastructure/stripe/dto/stripe.dto';

export function createFakeSpeiSource(req: CreatePaymentRequest): StripeSpeiSourceDto {
  const sourceId = generateId('src');
  const amountInCents = Math.round(req.amount * 100);

  // Deterministic CLABE based on orderId hash
  const orderHash = hashString(req.orderId);
  const clabe = '646180' + String(orderHash).padStart(12, '0').substring(0, 12);

  // Deterministic reference based on orderId hash
  const referenceHash = Math.abs(hashString(req.orderId + '_ref'));
  const reference = String(referenceHash % 10000000).padStart(7, '0');

  const expiresAt = Math.floor(Date.now() / 1000) + 72 * 60 * 60;

  return {
    id: sourceId,
    object: 'source',
    amount: amountInCents,
    currency: req.currency.toLowerCase(),
    status: 'pending',
    type: 'spei',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    spei: {
      bank: 'STP',
      clabe,
      reference,
    },
    expires_at: expiresAt,
  };
}
