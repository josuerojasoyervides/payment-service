import type { PaymentProviderId } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';

export type PaymentFlowSystemEventType =
  | 'REDIRECT_RETURNED'
  | 'EXTERNAL_STATUS_UPDATED'
  | 'WEBHOOK_RECEIVED'
  | 'CLIENT_CONFIRM_REQUESTED'
  | 'CLIENT_CONFIRM_SUCCEEDED'
  | 'CLIENT_CONFIRM_FAILED'
  | 'FINALIZE_REQUESTED'
  | 'FINALIZE_SUCCEEDED'
  | 'FINALIZE_FAILED'
  | 'FALLBACK_REQUESTED'
  | 'FALLBACK_EXECUTE'
  | 'FALLBACK_ABORT';

export interface RedirectReturnedPayload {
  providerId: PaymentProviderId;
  referenceId: string;
  /**
   * Optional nonce to deduplicate multiple returns for the same redirect.
   * If omitted, the machine will fall back to using `referenceId` as the nonce.
   */
  returnNonce?: string;
}

export interface ExternalStatusUpdatedPayload {
  providerId: PaymentProviderId;
  referenceId: string;
  /**
   * Optional provider event id used for webhook/external event deduplication.
   */
  eventId?: string;
}

export interface WebhookReceivedPayload {
  providerId: PaymentProviderId;
  referenceId?: string;
  /**
   * Optional provider event id used for webhook deduplication.
   */
  eventId?: string;
  raw?: unknown;
}

export const PAYMENT_FLOW_EVENT_MAP = {
  command: ['START', 'CONFIRM', 'CANCEL', 'REFRESH', 'RESET'],
  system: [
    'REDIRECT_RETURNED',
    'EXTERNAL_STATUS_UPDATED',
    'WEBHOOK_RECEIVED',
    'CLIENT_CONFIRM_REQUESTED',
    'CLIENT_CONFIRM_SUCCEEDED',
    'CLIENT_CONFIRM_FAILED',
    'FINALIZE_REQUESTED',
    'FINALIZE_SUCCEEDED',
    'FINALIZE_FAILED',
    'FALLBACK_REQUESTED',
    'FALLBACK_EXECUTE',
    'FALLBACK_ABORT',
  ],
} as const;
