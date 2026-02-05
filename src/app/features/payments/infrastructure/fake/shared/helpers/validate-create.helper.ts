import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { invalidRequestError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';

export function validateCreate(req: CreatePaymentRequest, providerId: PaymentProviderId) {
  if (!req.orderId) throw invalidRequestError('errors.order_id_required', { field: 'orderId' });
  if (!req.money?.currency)
    throw invalidRequestError('errors.currency_required', { field: 'currency' });
  if (!Number.isFinite(req.money?.amount) || req.money.amount <= 0)
    throw invalidRequestError('errors.amount_invalid', { field: 'amount' });
  if (!req.method?.type)
    throw invalidRequestError(PAYMENT_ERROR_KEYS.METHOD_TYPE_REQUIRED, {
      field: 'method.type',
    });
  if (providerId === PAYMENT_PROVIDER_IDS.paypal) return;
  if (req.method.type === 'card' && !req.method.token)
    throw invalidRequestError('errors.card_token_required', { field: 'method.token' });
}
