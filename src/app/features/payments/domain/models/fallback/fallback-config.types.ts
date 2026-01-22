import { PaymentErrorCode } from '../payment/payment-error.types';
import { PaymentProviderId } from '../payment/payment-intent.types';
import { FallbackMode } from './fallback-state.types';

/**
 * Fallback system configuration.
 */
export interface FallbackConfig {
  /** Whether fallback is enabled */
  enabled: boolean;

  /** Maximum number of fallback attempts */
  maxAttempts: number;

  /** Maximum wait time for user response (ms) */
  userResponseTimeout: number;

  /** Error codes that trigger fallback */
  triggerErrorCodes: PaymentErrorCode[];

  /** Providers in preference order for fallback */
  providerPriority: PaymentProviderId[];

  /** Fallback mode: 'manual' requires user confirmation, 'auto' executes automatically */
  mode: FallbackMode;

  /** Delay before executing automatic fallback (ms) - only applies in 'auto' mode */
  autoFallbackDelay: number;

  /** Maximum number of automatic fallbacks before requiring manual intervention */
  maxAutoFallbacks: number;
}

/**
 * Default fallback configuration.
 */
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
