/**
 * DTOs based on Stripe real API
 * @see Stripe docs (Payment Intents API)
 */

export interface StripePaymentIntentDto {
  id: string;
  object: 'payment_intent';
  amount: number;
  amount_received: number;
  currency: string;
  status: StripePaymentIntentStatus;
  client_secret: string;
  created: number;
  livemode: boolean;

  metadata?: Record<string, string>;
  description?: string;

  next_action?: StripeNextAction | null;

  payment_method?: string | null;
  payment_method_types: string[];

  last_payment_error?: StripePaymentError | null;

  capture_method: 'automatic' | 'manual';
  confirmation_method: 'automatic' | 'manual';

  receipt_email?: string | null;
}

export type StripeCreateResponseDto = StripePaymentIntentDto | StripeSpeiSourceDto;

export type StripePaymentIntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'requires_capture'
  | 'canceled'
  | 'succeeded';

export interface StripeNextAction {
  type: 'redirect_to_url' | 'use_stripe_sdk';
  redirect_to_url?: {
    url: string;
    return_url: string;
  };
  use_stripe_sdk?: {
    type: string;
    stripe_js: string;
  };
}

export interface StripePaymentError {
  code: string;
  doc_url: string;
  message: string;
  param?: string;
  type: 'api_error' | 'card_error' | 'idempotency_error' | 'invalid_request_error';
  charge?: string;
  decline_code?: string;
  payment_method?: {
    id: string;
    type: string;
  };
}

export interface StripeCreateIntentRequest {
  amount: number;
  currency: string;
  payment_method_types: string[];
  payment_method?: string;
  metadata?: Record<string, string>;
  description?: string;
  receipt_email?: string;
  capture_method?: 'automatic' | 'manual';
  confirm?: boolean;
  return_url?: string;
}

export interface StripeConfirmIntentRequest {
  payment_method?: string;
  return_url?: string;
}

// Stripe Mexico-specific SPEI (OXXO/SPEI via Sources)
export interface StripeSpeiSourceDto {
  id: string;
  object: 'source';
  amount: number;
  currency: string;
  status: 'pending' | 'chargeable' | 'consumed' | 'canceled' | 'failed';
  type: 'spei';
  created: number;
  livemode: boolean;

  spei: {
    bank: string;
    clabe: string;
    reference: string;
  };

  expires_at: number;
}

export interface StripeErrorResponse {
  error: {
    type: string;
    code: string;
    message: string;
    param?: string;
    decline_code?: string;
  };
}
