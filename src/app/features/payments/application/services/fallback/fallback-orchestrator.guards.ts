import { FallbackConfig } from '@payments/domain/models/fallback/fallback-config.types';
import {
  FallbackAvailableEvent,
  FallbackUserResponse,
} from '@payments/domain/models/fallback/fallback-event.types';
import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';

export function isFallbackEnabledGuard(config: FallbackConfig): boolean {
  return config.enabled;
}

export function isPendingEventForResponseGuard(
  event: FallbackAvailableEvent | null,
  response: FallbackUserResponse,
): event is FallbackAvailableEvent {
  return !!event && event.eventId === response.eventId;
}

export function isResponseAcceptedGuard(
  response: FallbackUserResponse,
): response is FallbackUserResponse & { accepted: true; selectedProvider: PaymentProviderId } {
  return !!response.accepted && !!response.selectedProvider;
}

export function isSelectedProviderInAlternativesGuard(
  event: FallbackAvailableEvent,
  selectedProvider: PaymentProviderId,
): boolean {
  return event.alternativeProviders.includes(selectedProvider);
}

export function isOriginalRequestAvailableGuard(
  originalRequest?: CreatePaymentRequest,
): originalRequest is CreatePaymentRequest {
  return !!originalRequest;
}

export function isEventExpiredGuard(
  event: FallbackAvailableEvent,
  config: FallbackConfig,
): boolean {
  const now = Date.now();
  return now - event.timestamp > config.userResponseTimeout;
}
