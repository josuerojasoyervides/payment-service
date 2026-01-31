import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';

export interface ReturnFlowReference {
  providerId: PaymentProviderId;
  referenceId: string | null;
  source: 'paypal' | 'stripe' | 'unknown';
}

function readParam(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : null;
  return null;
}

export function mapReturnQueryToReference(params: Record<string, unknown>): ReturnFlowReference {
  const paypalToken = readParam(params['token']);
  if (paypalToken) {
    return {
      providerId: 'paypal',
      referenceId: paypalToken,
      source: 'paypal',
    };
  }

  const stripeIntent =
    readParam(params['payment_intent']) ?? readParam(params['setup_intent']) ?? null;
  if (stripeIntent) {
    return {
      providerId: 'stripe',
      referenceId: stripeIntent,
      source: 'stripe',
    };
  }

  return {
    providerId: 'stripe',
    referenceId: null,
    source: 'unknown',
  };
}
