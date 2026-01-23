import {
  PaymentIntent,
  PaymentIntentStatus,
} from '@payments/domain/models/payment/payment-intent.types';
import { PaypalOrderDto } from '@payments/infrastructure/paypal/dto/paypal.dto';

export function mapPaypalOrder(dto: PaypalOrderDto): PaymentIntent {
  const statusMap: Record<PaypalOrderDto['status'], PaymentIntentStatus> = {
    CREATED: 'requires_action',
    SAVED: 'requires_confirmation',
    APPROVED: 'requires_confirmation',
    VOIDED: 'canceled',
    COMPLETED: 'succeeded',
    PAYER_ACTION_REQUIRED: 'requires_action',
  };

  const purchaseUnit = dto.purchase_units[0];
  const approveLink = dto.links.find((l) => l.rel === 'approve')?.href;

  return {
    id: dto.id,
    provider: 'paypal',
    status: statusMap[dto.status],
    amount: parseFloat(purchaseUnit?.amount?.value ?? '0'),
    currency: (purchaseUnit?.amount?.currency_code ?? 'MXN') as 'MXN' | 'USD',
    redirectUrl: approveLink,
    nextAction: approveLink
      ? {
          type: 'paypal_approve',
          approveUrl: approveLink,
          returnUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/payments/return`,
          cancelUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/payments/cancel`,
          paypalOrderId: dto.id,
        }
      : undefined,
    raw: dto,
  };
}
