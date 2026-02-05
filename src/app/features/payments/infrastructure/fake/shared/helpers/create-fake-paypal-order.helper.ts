// ============ FAKE PAYPAL RESPONSES ============

import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import {
  buildPaypalSandboxApproveUrl,
  buildPaypalSandboxCaptureUrl,
  buildPaypalSandboxOrderUrl,
} from '@app/features/payments/infrastructure/fake/shared/constants/fake-external-urls';
import { generateId } from '@app/features/payments/infrastructure/fake/shared/helpers/get-id.helper';
import type { PaypalOrderDto } from '@app/features/payments/infrastructure/paypal/core/dto/paypal.dto';

export function createFakePaypalOrder(req: CreatePaymentRequest): PaypalOrderDto {
  const orderId = generateId('ORDER').toUpperCase();

  return {
    id: orderId,
    status: 'CREATED',
    intent: 'CAPTURE',
    create_time: new Date().toISOString(),
    update_time: new Date().toISOString(),
    links: [
      {
        href: buildPaypalSandboxOrderUrl(orderId),
        rel: 'self',
        method: 'GET',
      },
      {
        href: buildPaypalSandboxApproveUrl(orderId),
        rel: 'approve',
        method: 'GET',
      },
      {
        href: buildPaypalSandboxCaptureUrl(orderId),
        rel: 'capture',
        method: 'POST',
      },
    ],
    purchase_units: [
      {
        reference_id: req.orderId.value,
        custom_id: req.orderId.value,
        description: `Order ${req.orderId.value}`,
        amount: {
          currency_code: req.money.currency,
          value: req.money.amount.toFixed(2),
        },
      },
    ],
  };
}
