import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';

export type PaymentFlowStageLabel =
  | 'INITIATE'
  | 'AUTHORIZE'
  | 'REQUIRES_ACTION'
  | 'CAPTURE'
  | 'SETTLE'
  | 'FAIL'
  | 'CANCEL';

export type PaymentFlowSystemEventType =
  | 'PROVIDER_UPDATE'
  | 'WEBHOOK_RECEIVED'
  | 'VALIDATION_FAILED'
  | 'STATUS_CONFIRMED'
  | 'FALLBACK_REQUESTED'
  | 'FALLBACK_EXECUTE'
  | 'FALLBACK_ABORT';

export interface ProviderUpdatePayload {
  providerId: PaymentProviderId;
  referenceId: string;
  status?: string;
  raw?: unknown;
}

export interface WebhookReceivedPayload {
  providerId: PaymentProviderId;
  referenceId?: string;
  eventType?: string;
  raw: unknown;
}

export interface ValidationFailedPayload {
  stage: PaymentFlowStageLabel;
  reason: string;
  raw?: unknown;
}

export interface StatusConfirmedPayload {
  providerId: PaymentProviderId;
  referenceId: string;
  status: string;
  raw?: unknown;
}

export const PAYMENT_FLOW_EVENT_MAP = {
  command: ['START', 'CONFIRM', 'CANCEL', 'REFRESH', 'RESET'],
  system: [
    'PROVIDER_UPDATE',
    'WEBHOOK_RECEIVED',
    'VALIDATION_FAILED',
    'STATUS_CONFIRMED',
    'FALLBACK_REQUESTED',
    'FALLBACK_EXECUTE',
    'FALLBACK_ABORT',
  ],
} as const;
