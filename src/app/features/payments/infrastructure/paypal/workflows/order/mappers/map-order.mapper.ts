import type {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import type { PaypalOrderDto } from '@payments/infrastructure/paypal/dto/paypal.dto';
import { findPaypalLink } from '@payments/infrastructure/paypal/dto/paypal.dto';
import { STATUS_MAP } from '@payments/infrastructure/paypal/workflows/order/mappers/status.mapper';

export function mapOrder(dto: PaypalOrderDto, providerId: PaymentProviderId): PaymentIntent {
  const status = STATUS_MAP[dto.status] ?? 'processing';
  const purchaseUnit = dto.purchase_units[0];

  const amount = parseFloat(purchaseUnit?.amount?.value ?? '0');
  const currency = purchaseUnit?.amount?.currency_code as 'MXN' | 'USD';

  const intent: PaymentIntent = {
    id: dto.id,
    provider: providerId,
    status,
    amount,
    currency,
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
