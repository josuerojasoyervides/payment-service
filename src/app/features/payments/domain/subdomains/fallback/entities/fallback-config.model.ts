import type { PaymentErrorCode } from '@payments/domain/subdomains/payment/entities/payment-error.types';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/entities/payment-provider.types';

export type FallbackMode = 'manual' | 'auto';

export interface FallbackConfig {
  enabled: boolean;
  maxAttempts: number;

  /** All durations are milliseconds. */
  userResponseTimeout: number;

  triggerErrorCodes: PaymentErrorCode[];
  providerPriority: PaymentProviderId[];

  mode: FallbackMode;

  /** Only applies when mode is 'auto'. */
  autoFallbackDelay: number;

  maxAutoFallbacks: number;
}

export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  enabled: true,
  maxAttempts: 2,
  userResponseTimeout: 30000,
  triggerErrorCodes: ['provider_unavailable', 'provider_error', 'network_error', 'timeout'],
  providerPriority: ['stripe', 'paypal'],
  mode: 'manual',
  autoFallbackDelay: 2000,
  maxAutoFallbacks: 1,
};
