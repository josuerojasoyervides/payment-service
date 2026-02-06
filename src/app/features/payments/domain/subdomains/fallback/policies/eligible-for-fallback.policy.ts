import type { FallbackConfig } from '@app/features/payments/domain/subdomains/fallback/entities/fallback-config.model';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';

/**
 * Pure policy: determines if an error is eligible to trigger fallback.
 *
 * Based on configured trigger error codes — no i18n, no infra.
 */
export function isEligibleForFallbackPolicy(config: FallbackConfig, error: PaymentError): boolean {
  if (config.blockedErrorCodes.includes(error.code)) return false;
  return config.triggerErrorCodes.includes(error.code);
}
