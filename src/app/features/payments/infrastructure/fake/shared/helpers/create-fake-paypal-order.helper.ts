// ============ FAKE PAYPAL RESPONSES ============

import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
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
        href: `https://api.sandbox.paypal.com/v2/checkout/orders/${orderId}`,
        rel: 'self',
        method: 'GET',
      },
      {
        href: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`,
        rel: 'approve',
        method: 'GET',
      },
      {
        href: `https://api.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`,
        rel: 'capture',
        method: 'POST',
      },
    ],
    purchase_units: [
      {
        reference_id: req.orderId,
        custom_id: req.orderId,
        description: `Order ${req.orderId}`,
        amount: {
          currency_code: req.money.currency,
          value: req.money.amount.toFixed(2),
        },
      },
    ],
  };
}
