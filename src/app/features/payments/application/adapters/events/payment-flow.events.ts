import type { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';

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
}

export interface ExternalStatusUpdatedPayload {
  providerId: PaymentProviderId;
  referenceId: string;
}

export interface WebhookReceivedPayload {
  providerId: PaymentProviderId;
  referenceId?: string;
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
