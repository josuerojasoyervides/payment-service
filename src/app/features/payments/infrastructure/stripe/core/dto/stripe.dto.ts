import { z } from 'zod';

// ===============
// Payment Intent
// ===============

export const StripePaymentIntentStatusSchema = z.enum([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
  'processing',
  'requires_capture',
  'canceled',
  'succeeded',
]);
export type StripePaymentIntentStatus = z.infer<typeof StripePaymentIntentStatusSchema>;

export const StripeCaptureMethodSchema = z.enum(['automatic', 'manual']);
export type StripeCaptureMethod = z.infer<typeof StripeCaptureMethodSchema>;

export const StripeConfirmationMethodSchema = z.enum(['automatic', 'manual']);
export type StripeConfirmationMethod = z.infer<typeof StripeConfirmationMethodSchema>;

export const StripePaymentErrorSchema = z.object({
  code: z.string().optional(),
  doc_url: z.string().optional(),
  message: z.string(),
  param: z.string().optional(),
  type: z.string().optional(),
  charge: z.string().optional(),
  decline_code: z.string().optional(),
  payment_method: z.object({ id: z.string(), type: z.string() }).optional(),
});
export type StripePaymentError = z.infer<typeof StripePaymentErrorSchema>;

export const StripeNextActionSchema = z.object({
  type: z.enum(['redirect_to_url', 'use_stripe_sdk']),
  redirect_to_url: z.object({ url: z.string(), return_url: z.string() }).optional(),
  use_stripe_sdk: z.object({ type: z.string(), stripe_js: z.string() }).optional(),
});
export type StripeNextAction = z.infer<typeof StripeNextActionSchema>;

export const StripeCreateIntentRequestSchema = z.object({
  amount: z.number(),
  currency: z.string(),
  payment_method_types: z.array(z.string()),
  payment_method: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  description: z.string().optional(),
  receipt_email: z.string().optional(),
  capture_method: z.enum(['automatic', 'manual']).optional(),
  confirm: z.boolean().optional(),
  return_url: z.string().optional(),
});
export type StripeCreateIntentRequest = z.infer<typeof StripeCreateIntentRequestSchema>;

export const StripeConfirmIntentRequestSchema = z.object({
  payment_method: z.string().optional(),
  return_url: z.string().optional(),
});
export type StripeConfirmIntentRequest = z.infer<typeof StripeConfirmIntentRequestSchema>;

export const StripePaymentIntentSchema = z.object({
  id: z.string(),
  object: z.literal('payment_intent'),
  amount: z.number(),
  amount_received: z.number(),
  currency: z.string(),
  status: StripePaymentIntentStatusSchema,
  client_secret: z.string(),
  created: z.number(),
  livemode: z.boolean(),
  metadata: z.record(z.string(), z.string()).optional(),
  description: z.string().optional(),
  next_action: StripeNextActionSchema.optional().nullable(),
  payment_method: z.string().optional().nullable(),
  payment_method_types: z.array(z.string()),
  last_payment_error: StripePaymentErrorSchema.optional().nullable(),
  capture_method: StripeCaptureMethodSchema,
  confirmation_method: StripeConfirmationMethodSchema,
  receipt_email: z.string().email().optional().nullable(),
});
export type StripePaymentIntentDto = z.infer<typeof StripePaymentIntentSchema>;

// ===============
// SPEI Source
// ===============

export const StripeSpeiSourceSchema = z.object({
  id: z.string(),
  object: z.literal('source'),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(['pending', 'chargeable', 'consumed', 'canceled', 'failed']),
  type: z.literal('spei'),
  created: z.number(),
  livemode: z.boolean(),
  spei: z.object({
    bank: z.string(),
    clabe: z.string(),
    reference: z.string(),
  }),
  expires_at: z.number(),
});
export type StripeSpeiSourceDto = z.infer<typeof StripeSpeiSourceSchema>;

// ===============
// Error envelope
// ===============

export const StripeErrorResponseSchema = z.object({
  error: z.object({
    type: z.string().optional(),
    code: z.string().optional(),
    message: z.string(),
    param: z.string().optional(),
    decline_code: z.string().optional(),
  }),
});
export type StripeErrorResponse = z.infer<typeof StripeErrorResponseSchema>;

export function isStripeErrorResponse(value: unknown): value is StripeErrorResponse {
  return StripeErrorResponseSchema.safeParse(value).success;
}

// ===============
// Create Response union
// ===============

export const StripeCreateResponseDtoSchema = z.discriminatedUnion('object', [
  StripePaymentIntentSchema,
  StripeSpeiSourceSchema,
]);
export type StripeCreateResponseDto = z.infer<typeof StripeCreateResponseDtoSchema>;
