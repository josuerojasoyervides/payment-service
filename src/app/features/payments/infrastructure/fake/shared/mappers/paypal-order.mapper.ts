import type {
  PaymentIntent,
  PaymentIntentStatus,
} from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaypalOrderDto } from '@app/features/payments/infrastructure/paypal/core/dto/paypal.dto';
import { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';
import { PAYMENT_PROVIDER_IDS } from '@payments/shared/constants/payment-provider-ids';

function toPaymentIntentIdOrThrow(raw: string): PaymentIntentId {
  const result = PaymentIntentId.from(raw);
  if (!result.ok) throw new Error(`Invalid intent id from provider: ${raw}`);
  return result.value;
}

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
    id: toPaymentIntentIdOrThrow(dto.id),
    provider: PAYMENT_PROVIDER_IDS.paypal,
    status: statusMap[dto.status],
    money: {
      amount: parseFloat(purchaseUnit?.amount?.value ?? '0'),
      currency: (purchaseUnit?.amount?.currency_code ?? 'MXN') as 'MXN' | 'USD',
    },
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
