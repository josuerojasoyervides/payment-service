/**
 * DTOs based on PayPal Orders v2 real API
 * @see PayPal docs (Orders v2 API)
 */

import { z } from 'zod';

export const PaypalOrderStatusSchema = z.enum([
  'CREATED',
  'SAVED',
  'APPROVED',
  'VOIDED',
  'COMPLETED',
  'PAYER_ACTION_REQUIRED',
]);
export type PaypalOrderStatus = z.infer<typeof PaypalOrderStatusSchema>;

export const PaypalLinkSchema = z.object({
  href: z.string(),
  rel: z.enum(['self', 'approve', 'update', 'capture', 'payer-action']),
  method: z.enum(['GET', 'POST', 'PATCH']),
});
export type PaypalLink = z.infer<typeof PaypalLinkSchema>;

export const PaypalMoneySchema = z.object({
  currency_code: z.string(),
  value: z.string(),
});
export type PaypalMoney = z.infer<typeof PaypalMoneySchema>;

export const PaypalItemSchema = z.object({
  name: z.string(),
  quantity: z.string(),
  unit_amount: PaypalMoneySchema,
  description: z.string().optional(),
  sku: z.string().optional(),
  category: z.enum(['DIGITAL_GOODS', 'PHYSICAL_GOODS', 'DONATION']).optional(),
});
export type PaypalItem = z.infer<typeof PaypalItemSchema>;

export const PaypalCaptureSchema = z.object({
  id: z.string(),
  status: z.enum(['COMPLETED', 'DECLINED', 'PARTIALLY_REFUNDED', 'PENDING', 'REFUNDED']),
  amount: PaypalMoneySchema,
  final_capture: z.boolean(),
  create_time: z.string(),
  update_time: z.string(),
});
export type PaypalCapture = z.infer<typeof PaypalCaptureSchema>;

export const PaypalAuthorizationSchema = z.object({
  id: z.string(),
  status: z.enum(['CREATED', 'CAPTURED', 'DENIED', 'EXPIRED', 'PENDING', 'VOIDED']),
  amount: PaypalMoneySchema,
  create_time: z.string(),
  expiration_time: z.string(),
});
export type PaypalAuthorization = z.infer<typeof PaypalAuthorizationSchema>;

export const PaypalPurchaseUnitSchema = z.object({
  reference_id: z.string(),
  description: z.string().optional(),
  custom_id: z.string().optional(),
  invoice_id: z.string().optional(),
  soft_descriptor: z.string().optional(),
  amount: z.object({
    currency_code: z.string(),
    value: z.string(),
    breakdown: z
      .object({
        item_total: PaypalMoneySchema.optional(),
        shipping: PaypalMoneySchema.optional(),
        tax_total: PaypalMoneySchema.optional(),
        discount: PaypalMoneySchema.optional(),
      })
      .optional(),
  }),
  items: z.array(PaypalItemSchema).optional(),
  payments: z
    .object({
      captures: z.array(PaypalCaptureSchema).optional(),
      authorizations: z.array(PaypalAuthorizationSchema).optional(),
    })
    .optional(),
});
export type PaypalPurchaseUnit = z.infer<typeof PaypalPurchaseUnitSchema>;

export const PaypalPayerSchema = z.object({
  payer_id: z.string(),
  email_address: z.string().optional(),
  name: z
    .object({
      given_name: z.string(),
      surname: z.string(),
    })
    .optional(),
  address: z
    .object({
      country_code: z.string(),
    })
    .optional(),
});
export type PaypalPayer = z.infer<typeof PaypalPayerSchema>;

export const PaypalPaymentSourceSchema = z.object({
  paypal: z
    .object({
      account_id: z.string(),
      email_address: z.string(),
      name: z.object({
        given_name: z.string(),
        surname: z.string(),
      }),
    })
    .optional(),
  card: z
    .object({
      brand: z.string(),
      last_digits: z.string(),
      type: z.enum(['CREDIT', 'DEBIT']),
    })
    .optional(),
});
export type PaypalPaymentSource = z.infer<typeof PaypalPaymentSourceSchema>;

export const PaypalOrderDtoSchema = z.object({
  id: z.string(),
  status: PaypalOrderStatusSchema,
  intent: z.enum(['CAPTURE', 'AUTHORIZE']),
  create_time: z.string(),
  update_time: z.string(),
  links: z.array(PaypalLinkSchema),
  purchase_units: z.array(PaypalPurchaseUnitSchema),
  payer: PaypalPayerSchema.optional(),
  payment_source: PaypalPaymentSourceSchema.optional(),
});
export type PaypalOrderDto = z.infer<typeof PaypalOrderDtoSchema>;

export const PaypalCreateOrderRequestSchema = z.object({
  intent: z.enum(['CAPTURE', 'AUTHORIZE']),
  purchase_units: z.array(
    z.object({
      reference_id: z.string().optional(),
      amount: z.object({
        currency_code: z.string(),
        value: z.string(),
      }),
      description: z.string().optional(),
      custom_id: z.string().optional(),
    }),
  ),
  application_context: z
    .object({
      brand_name: z.string().optional(),
      landing_page: z.enum(['LOGIN', 'BILLING', 'NO_PREFERENCE']).optional(),
      user_action: z.enum(['PAY_NOW', 'CONTINUE']).optional(),
      return_url: z.string().optional(),
      cancel_url: z.string().optional(),
    })
    .optional(),
});
export type PaypalCreateOrderRequest = z.infer<typeof PaypalCreateOrderRequestSchema>;

export const PaypalErrorResponseSchema = z.object({
  name: z.string(),
  message: z.string(),
  debug_id: z.string(),
  details: z
    .array(
      z.object({
        field: z.string(),
        value: z.string(),
        location: z.string(),
        issue: z.string(),
        description: z.string(),
      }),
    )
    .optional(),
  links: z.array(PaypalLinkSchema).optional(),
});
export type PaypalErrorResponse = z.infer<typeof PaypalErrorResponseSchema>;

export function isPaypalOrderDto(value: unknown): value is PaypalOrderDto {
  return PaypalOrderDtoSchema.safeParse(value).success;
}

export function parsePaypalOrderDto(value: unknown): PaypalOrderDto | null {
  const parsed = PaypalOrderDtoSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// Helpers to extract links
export function findPaypalLink(links: PaypalLink[], rel: PaypalLink['rel']): string | null {
  return links.find((l) => l.rel === rel)?.href ?? null;
}
