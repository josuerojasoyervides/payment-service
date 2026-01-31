import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { FallbackConfig } from '@payments/domain/subdomains/fallback/contracts/fallback-config.types';
import type {
  FallbackAvailableEvent,
  FallbackUserResponse,
} from '@payments/domain/subdomains/fallback/contracts/fallback-event.event';
import type {
  FallbackState,
  FallbackStatus,
} from '@payments/domain/subdomains/fallback/contracts/fallback-state.types';
import type { CreatePaymentRequest } from '@payments/domain/subdomains/payment/contracts/payment-request.command';

/**
 * ✅ Config / Enabled
 */
export function isFallbackEnabledGuard(config: FallbackConfig): boolean {
  return config.enabled;
}

/**
 * ✅ Presence guards (Type Guards)
 */
export function isPendingEventGuard(
  event: FallbackAvailableEvent | null,
): event is FallbackAvailableEvent {
  return !!event;
}

export function isOriginalRequestAvailableGuard(
  originalRequest?: CreatePaymentRequest,
): originalRequest is CreatePaymentRequest {
  return !!originalRequest;
}

/**
 * ✅ Event matching
 */
export function isPendingEventForResponseGuard(
  event: FallbackAvailableEvent | null,
  response: FallbackUserResponse,
): event is FallbackAvailableEvent {
  return !!event && event.eventId === response.eventId;
}

export function isSameEventAndNotRespondedGuard(
  eventId: string,
  currentEventId: string | undefined,
  status: FallbackStatus,
): boolean {
  return eventId === currentEventId && status === 'pending';
}

export function hasDifferentEventId(
  eventId: string,
  currentEventId?: string,
): currentEventId is string {
  return !!currentEventId && eventId !== currentEventId;
}

/**
 * ✅ Response guards (Type Guards)
 */
export function isResponseAcceptedGuard(
  response: FallbackUserResponse,
): response is FallbackUserResponse & { accepted: true; selectedProvider: PaymentProviderId } {
  return !!response.accepted && !!response.selectedProvider;
}

/**
 * ✅ Provider selection validation
 */
export function isSelectedProviderInAlternativesGuard(
  event: FallbackAvailableEvent,
  selectedProvider: PaymentProviderId,
): boolean {
  return event.alternativeProviders.includes(selectedProvider);
}

/**
 * ✅ Expiration guards
 */
export function isEventExpiredByAgeGuard(eventAge: number, userResponseTimeout: number): boolean {
  return eventAge >= userResponseTimeout;
}

export function isEventExpiredGuard(
  event: FallbackAvailableEvent,
  config: FallbackConfig,
): boolean {
  const now = Date.now();
  return now - event.timestamp > config.userResponseTimeout;
}

/**
 * ✅ State/status guards
 */
export function isAutoExecutingGuard(state: FallbackState, provider: PaymentProviderId): boolean {
  return state.status === 'auto_executing' && state.currentProvider === provider;
}
