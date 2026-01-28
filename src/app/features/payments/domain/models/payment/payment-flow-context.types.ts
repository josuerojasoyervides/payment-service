/**
 * Payment flow context.
 *
 * Contains additional information passed during the flow,
 * such as return URLs, device data, and metadata.
 */
import { PaymentProviderId } from './payment-intent.types';

export type ProviderReferenceKey = 'intentId' | 'orderId' | 'preferenceId' | 'paymentId';

export type ProviderReferenceSet = Partial<Record<ProviderReferenceKey, string>> &
  Record<string, string | undefined>;

export type ProviderReferences = Partial<Record<PaymentProviderId, ProviderReferenceSet>>;

export interface PaymentFlowContext {
  /** Stable internal flow id for correlation */
  flowId?: string;

  /** Provider chosen for the current flow */
  providerId?: PaymentProviderId;

  /** Correlation reference (e.g., order id or external reference) */
  externalReference?: string;

  /** Provider-specific references (supports id swap flows) */
  providerRefs?: ProviderReferences;

  /** Timestamps for lifecycle and persistence */
  createdAt?: number;
  expiresAt?: number;

  /** Last external system event id (for dedupe) */
  lastExternalEventId?: string;

  /** Last return nonce (for return re-entry validation) */
  lastReturnNonce?: string;

  /** Sanitized return parameters (safe allowlist only) */
  returnParamsSanitized?: Record<string, string>;

  /** Return URL after 3DS or redirect */
  returnUrl?: string;

  /** Cancel URL (for PayPal) */
  cancelUrl?: string;

  /** Indicates if this is a test environment */
  isTest?: boolean;

  /** Device info for fraud prevention */
  deviceData?: {
    ipAddress?: string;
    userAgent?: string;
    screenWidth?: number;
    screenHeight?: number;
  };

  /** Additional custom metadata */
  metadata?: Record<string, unknown>;
}
