import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { generateId } from '@app/features/payments/infrastructure/fake/shared/helpers/get-id.helper';
import { hashString } from '@app/features/payments/infrastructure/fake/shared/helpers/hash-string.helper';
import type { StripeSpeiSourceDto } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';
import { SPEI_RAW_KEYS } from '@app/features/payments/infrastructure/stripe/shared/constants/raw-keys.constants';

export function createFakeSpeiSource(req: CreatePaymentRequest): StripeSpeiSourceDto {
  const sourceId = generateId('src');
  const amountInCents = Math.round(req.money.amount * 100);

  // Deterministic CLABE based on orderId hash
  const orderHash = hashString(req.orderId.value);
  const speiClabe = '646180' + String(orderHash).padStart(12, '0').substring(0, 12);

  // Deterministic reference based on orderId hash
  const referenceHash = Math.abs(hashString(req.orderId.value + '_ref'));
  const speiReference = String(referenceHash % 10000000).padStart(7, '0');

  const expiresAt = Math.floor(Date.now() / 1000) + 72 * 60 * 60;

  return {
    id: sourceId,
    object: 'source',
    amount: amountInCents,
    currency: req.money.currency.toLowerCase(),
    status: 'pending',
    type: 'spei',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    spei: {
      [SPEI_RAW_KEYS.BANK]: 'STP',
      [SPEI_RAW_KEYS.CLABE]: speiClabe,
      [SPEI_RAW_KEYS.REFERENCE]: speiReference,
    },
    expires_at: expiresAt,
  };
}
