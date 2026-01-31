import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { I18nKeys } from '@core/i18n';
import { invalidRequestError } from '@payments/domain/subdomains/payment/contracts/payment-error.factory';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';

export function validateCreate(req: CreatePaymentRequest, providerId: PaymentProviderId) {
  if (!req.orderId) throw invalidRequestError('errors.order_id_required', { field: 'orderId' });
  if (!req.currency) throw invalidRequestError('errors.currency_required', { field: 'currency' });
  if (!Number.isFinite(req.amount) || req.amount <= 0)
    throw invalidRequestError('errors.amount_invalid', { field: 'amount' });
  if (!req.method?.type)
    throw invalidRequestError(I18nKeys.errors.method_type_required, { field: 'method.type' });
  if (providerId === 'paypal') return;
  if (req.method.type === 'card' && !req.method.token)
    throw invalidRequestError('errors.card_token_required', { field: 'method.token' });
}
