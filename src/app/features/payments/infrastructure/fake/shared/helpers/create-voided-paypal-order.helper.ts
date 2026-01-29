import type { PaypalOrderDto } from '@app/features/payments/infrastructure/paypal/core/dto/paypal.dto';

export function createVoidedPaypalOrder(orderId: string): PaypalOrderDto {
  return {
    id: orderId,
    status: 'VOIDED',
    intent: 'CAPTURE',
    create_time: new Date(Date.now() - 60000).toISOString(),
    update_time: new Date().toISOString(),
    links: [],
    purchase_units: [
      {
        reference_id: 'order_demo',
        amount: {
          currency_code: 'MXN',
          value: '100.00',
        },
      },
    ],
  };
}
