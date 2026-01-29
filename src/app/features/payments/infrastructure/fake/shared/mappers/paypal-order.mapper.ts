import type { PaypalOrderDto } from '@app/features/payments/infrastructure/paypal/core/dto/paypal.dto';
import type {
  PaymentIntent,
  PaymentIntentStatus,
} from '@payments/domain/subdomains/payment/contracts/payment-intent.types';

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
          kind: 'redirect',
          url: approveLink,
        }
      : undefined,
    raw: dto,
  };
}
