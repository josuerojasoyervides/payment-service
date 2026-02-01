/**
 * Test-only fake: GetPaymentStatusUseCase that returns a configurable status sequence
 * (e.g. processing -> processing -> succeeded) with optional latency (fake timers).
 * Provider-agnostic.
 */
import type {
  PaymentIntent,
  PaymentIntentStatus,
} from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import type { GetPaymentStatusRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import type { Observable } from 'rxjs';
import { of, switchMap, timer } from 'rxjs';

export interface FlakyStatusUseCaseFakeConfig {
  /** Status sequence returned per call (e.g. ['processing', 'processing', 'succeeded']). */
  statusSequence: PaymentIntentStatus[];
  /** Intent id and provider used for all returned intents. */
  intentId: string;
  providerId: PaymentProviderId;
  amount?: number;
  currency?: 'MXN' | 'USD';
  /** Delay in ms before resolving (use with fake timers). Default 0. */
  latencyMs?: number;
}

/**
 * Returns an object compatible with GetPaymentStatusUseCase.execute shape:
 * (req, providerId) => Observable<PaymentIntent>
 * Each call returns the next status in the sequence; after sequence exhausts, returns last status.
 */
export function createFlakyStatusUseCaseFake(config: FlakyStatusUseCaseFakeConfig): {
  execute: (
    req: GetPaymentStatusRequest,
    providerId: PaymentProviderId,
  ) => Observable<PaymentIntent>;
} {
  let callIndex = 0;
  const statusSequence = config.statusSequence;
  const latencyMs = config.latencyMs ?? 0;
  const baseIntent: PaymentIntent = {
    id: config.intentId,
    provider: config.providerId,
    status: 'processing',
    amount: config.amount ?? 100,
    currency: config.currency ?? 'MXN',
  };

  return {
    execute(
      _req: GetPaymentStatusRequest,
      providerId: PaymentProviderId,
    ): Observable<PaymentIntent> {
      const status = statusSequence[Math.min(callIndex, statusSequence.length - 1)] ?? 'succeeded';
      callIndex += 1;
      const intent: PaymentIntent = { ...baseIntent, provider: providerId, status };
      if (latencyMs <= 0) return of(intent);
      return timer(latencyMs).pipe(switchMap(() => of(intent)));
    },
  };
}
