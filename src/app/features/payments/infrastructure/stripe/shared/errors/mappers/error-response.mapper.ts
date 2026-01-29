import type { StripeErrorResponse } from '@app/features/payments/infrastructure/stripe/core/dto/stripe.dto';

interface StripeErrorEnvelope {
  error: StripeErrorResponse['error'];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isStripeErrorResponse(err: unknown): err is StripeErrorEnvelope {
  if (!isRecord(err)) return false;
  if (!('error' in err)) return false;

  const envelope = err as Record<string, unknown>;
  const inner = envelope['error'];

  if (!isRecord(inner)) return false;
  if (!('type' in inner)) return false;

  return true;
}
