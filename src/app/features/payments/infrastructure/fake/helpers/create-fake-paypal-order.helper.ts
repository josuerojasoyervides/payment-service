// ============ FAKE PAYPAL RESPONSES ============

import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { PaypalOrderDto } from '@payments/infrastructure/paypal/dto/paypal.dto';

import { generateId } from './get-id.helper';

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
        description: `Orden ${req.orderId}`,
        amount: {
          currency_code: req.currency,
          value: req.amount.toFixed(2),
        },
      },
    ],
  };
}
