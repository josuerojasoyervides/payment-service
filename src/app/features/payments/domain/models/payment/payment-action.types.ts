export type NextAction =
  | NextActionRedirect
  | NextActionSpei
  | NextActionThreeDs
  | NextActionPaypalApprove;

/**
 * Generic redirect to an external URL.
 */
export interface NextActionRedirect {
  type: 'redirect';
  url: string;
  returnUrl?: string;
}

/**
 * SPEI transfer - requires user to perform transfer manually.
 */
export interface NextActionSpei {
  type: 'spei';
  /** Readable instructions for the user */
  instructions: string;
  /** 18-digit CLABE */
  clabe: string;
  /** Numeric reference for the concept */
  reference: string;
  /** Receiving bank */
  bank: string;
  /** Beneficiary */
  beneficiary: string;
  /** Exact amount to transfer */
  amount: number;
  /** Currency */
  currency: string;
  /** Deadline date/time to make payment (ISO 8601) */
  expiresAt: string;
}

/**
 * 3D Secure - additional cardholder authentication.
 */
export interface NextActionThreeDs {
  type: '3ds';
  /** Client secret for Stripe.js */
  clientSecret: string;
  /** Return URL after 3DS */
  returnUrl: string;
  /** 3DS version (1.0, 2.0, 2.1, 2.2) */
  threeDsVersion?: string;
}

/**
 * PayPal - requires user approval in PayPal.
 */
export interface NextActionPaypalApprove {
  type: 'paypal_approve';
  /** URL to redirect user to PayPal */
  approveUrl: string;
  /** Return URL after approval */
  returnUrl: string;
  /** URL if user cancels in PayPal */
  cancelUrl: string;
  /** Order ID in PayPal */
  paypalOrderId: string;
}
