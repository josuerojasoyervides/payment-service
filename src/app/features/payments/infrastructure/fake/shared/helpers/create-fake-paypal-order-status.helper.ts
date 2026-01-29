import type { PaypalOrderDto } from '@app/features/payments/infrastructure/paypal/core/dto/paypal.dto';

export function createFakePaypalOrderStatus(orderId: string): PaypalOrderDto {
  return {
    id: orderId,
    status: 'APPROVED',
    intent: 'CAPTURE',
    create_time: new Date(Date.now() - 120000).toISOString(),
    update_time: new Date().toISOString(),
    links: [
      {
        href: `https://api.sandbox.paypal.com/v2/checkout/orders/${orderId}`,
        rel: 'self',
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
        reference_id: 'order_demo',
        amount: {
          currency_code: 'MXN',
          value: '100.00',
        },
      },
    ],
    payer: {
      payer_id: 'PAYER123456',
      email_address: 'buyer@example.com',
    },
  };
}
