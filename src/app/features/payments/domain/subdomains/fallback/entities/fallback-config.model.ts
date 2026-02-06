import type { FallbackMode } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-modes.types';
import type { PaymentErrorCode } from '@payments/domain/subdomains/payment/entities/payment-error.types';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/entities/payment-provider.types';

export interface FallbackConfig {
  enabled: boolean;
  maxAttempts: number;

  /** All durations are milliseconds. */
  userResponseTimeout: number;

  triggerErrorCodes: PaymentErrorCode[];
  blockedErrorCodes: PaymentErrorCode[];
  providerPriority: PaymentProviderId[];

  mode: FallbackMode;

  /** Only applies when mode is 'auto'. */
  autoFallbackDelay: number;

  maxAutoFallbacks: number;
}
