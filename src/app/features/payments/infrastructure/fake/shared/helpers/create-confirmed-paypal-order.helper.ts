import { generateId } from '@app/features/payments/infrastructure/fake/shared/helpers/get-id.helper';
import type { PaypalOrderDto } from '@app/features/payments/infrastructure/paypal/core/dto/paypal.dto';
import { buildPaypalSandboxOrderUrl } from '@payments/shared/constants/fake-external-urls';

export function createConfirmedPaypalOrder(orderId: string): PaypalOrderDto {
  const captureId = generateId('CAPTURE').toUpperCase();

  return {
    id: orderId,
    status: 'COMPLETED',
    intent: 'CAPTURE',
    create_time: new Date(Date.now() - 60000).toISOString(),
    update_time: new Date().toISOString(),
    links: [
      {
        href: buildPaypalSandboxOrderUrl(orderId),
        rel: 'self',
        method: 'GET',
      },
    ],
    purchase_units: [
      {
        reference_id: 'order_demo',
        amount: {
          currency_code: 'MXN',
          value: '100.00',
        },
        payments: {
          captures: [
            {
              id: captureId,
              status: 'COMPLETED',
              amount: {
                currency_code: 'MXN',
                value: '100.00',
              },
              final_capture: true,
              create_time: new Date().toISOString(),
              update_time: new Date().toISOString(),
            },
          ],
        },
      },
    ],
    payer: {
      payer_id: 'PAYER123456',
      email_address: 'buyer@example.com',
      name: {
        given_name: 'Test',
        surname: 'Buyer',
      },
    },
  };
}
