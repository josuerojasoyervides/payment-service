import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { PaypalOrderDto } from '@app/features/payments/infrastructure/paypal/core/dto/paypal.dto';
import { findPaypalLink } from '@app/features/payments/infrastructure/paypal/core/dto/paypal.dto';
import { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';
import { STATUS_MAP } from '@payments/infrastructure/paypal/workflows/order/mappers/status.mapper';

function toPaymentIntentIdOrThrow(raw: string): PaymentIntentId {
  const result = PaymentIntentId.from(raw);
  if (!result.ok) throw new Error(`Invalid intent id from provider: ${raw}`);
  return result.value;
}

export function mapOrder(dto: PaypalOrderDto, providerId: PaymentProviderId): PaymentIntent {
  const status = STATUS_MAP[dto.status] ?? 'processing';
  const purchaseUnit = dto.purchase_units[0];

  const amount = parseFloat(purchaseUnit?.amount?.value ?? '0');
  const currency = purchaseUnit?.amount?.currency_code as 'MXN' | 'USD';

  const intent: PaymentIntent = {
    id: toPaymentIntentIdOrThrow(dto.id),
    provider: providerId,
    status,
    money: { amount, currency },
    raw: dto,
  };

  if (dto.status === 'CREATED' || dto.status === 'PAYER_ACTION_REQUIRED') {
    const approveUrl = findPaypalLink(dto.links, 'approve');
    if (approveUrl) {
      intent.redirectUrl = approveUrl;
      // Do not build nextAction here - PaypalRedirectStrategy.enrichIntentWithPaypalApproval
      // will build it with the correct URLs from StrategyContext (metadata)
      // If we needed to build here, we'd require access to the original request (returnUrl/cancelUrl)
    }
  }

  return intent;
}
