import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';

import { findPaypalLink, PaypalOrderDto } from '../dto/paypal.dto';
import { STATUS_MAP } from './status.mapper';

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
      // No construir nextAction aquí - PaypalRedirectStrategy.enrichIntentWithPaypalApproval
      // lo construirá con las URLs correctas desde StrategyContext (metadata)
      // Si necesitamos construir aquí, requeriríamos acceso al request original con returnUrl/cancelUrl
    }
  }

  if (dto.status === 'COMPLETED' && purchaseUnit?.payments?.captures?.[0]) {
    const capture = purchaseUnit.payments.captures[0];
    console.log(`[PaypalGateway] Capture ID: ${capture.id}, Status: ${capture.status}`);
  }

  return intent;
}
