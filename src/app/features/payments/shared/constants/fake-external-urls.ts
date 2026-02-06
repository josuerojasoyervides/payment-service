export const PAYPAL_SANDBOX_API_BASE_URL = 'https://api.sandbox.paypal.com/v2/checkout/orders';
export const PAYPAL_SANDBOX_CHECKOUT_BASE_URL = 'https://www.sandbox.paypal.com/checkoutnow';
export const STRIPE_3DS_AUTH_BASE_URL = 'https://hooks.stripe.com/3d_secure_2/authenticate';

export function buildPaypalSandboxOrderUrl(orderId: string): string {
  return `${PAYPAL_SANDBOX_API_BASE_URL}/${orderId}`;
}

export function buildPaypalSandboxApproveUrl(orderId: string): string {
  return `${PAYPAL_SANDBOX_CHECKOUT_BASE_URL}?token=${orderId}`;
}

export function buildPaypalSandboxCaptureUrl(orderId: string): string {
  return `${PAYPAL_SANDBOX_API_BASE_URL}/${orderId}/capture`;
}

export function buildStripe3dsAuthUrl(intentId: string): string {
  return `${STRIPE_3DS_AUTH_BASE_URL}/${intentId}`;
}
