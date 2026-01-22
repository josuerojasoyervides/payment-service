import { Signal } from '@angular/core';
import {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
  PaymentIntent,
  PaymentProviderId,
  PaymentError,
  FallbackAvailableEvent,
  FallbackState,
} from '../../domain/models';
import { StrategyContext } from '../../domain/ports';
import { PaymentHistoryEntry, PaymentsState, PaymentFlowStatus } from '../store/payment.models';

/**
 * Función para cancelar suscripción.
 */
export type Unsubscribe = () => void;

/**
 * Resumen de debug del estado.
 */
export interface PaymentDebugSummary {
  status: PaymentFlowStatus;
  intentId: string | null;
  provider: PaymentProviderId | null;
  fallbackStatus: FallbackState['status'];
  isAutoFallback: boolean;
  historyCount: number;
}

/**
 * Port para el estado de pagos.
 *
 * Esta interface define el contrato que cualquier implementación
 * de manejo de estado debe cumplir. Permite desacoplar los componentes
 * de la implementación concreta (NgRx Signals, Akita, NGXS, etc.).
 *
 * Principios:
 * - Los componentes solo conocen este port
 * - La implementación concreta se inyecta vía token
 * - Facilita testing y cambios de tecnología
 *
 * @example
 * ```typescript
 * // En el componente
 * private readonly state = inject(PAYMENT_STATE);
 *
 * readonly isLoading = this.state.isLoading;
 * readonly intent = this.state.intent;
 *
 * pay() {
 *   this.state.startPayment(request, 'stripe');
 * }
 * ```
 */
export interface PaymentStatePort {
  // ============================================================
  // ESTADO REACTIVO (Signals)
  // ============================================================

  /** Estado completo como signal (para casos avanzados) */
  readonly state: Signal<PaymentsState>;

  /** Si hay un pago en proceso */
  readonly isLoading: Signal<boolean>;

  /** Si hay un pago completado exitosamente */
  readonly isReady: Signal<boolean>;

  readonly hasError: Signal<boolean>;

  readonly intent: Signal<PaymentIntent | null>;

  readonly error: Signal<PaymentError | null>;

  readonly selectedProvider: Signal<PaymentProviderId | null>;

  readonly hasPendingFallback: Signal<boolean>;

  readonly isAutoFallbackInProgress: Signal<boolean>;

  readonly isFallbackExecuting: Signal<boolean>;

  readonly isAutoFallback: Signal<boolean>;

  readonly pendingFallbackEvent: Signal<FallbackAvailableEvent | null>;

  readonly fallbackState: Signal<FallbackState>;

  readonly historyCount: Signal<number>;

  readonly lastHistoryEntry: Signal<PaymentHistoryEntry | null>;

  readonly history: Signal<PaymentHistoryEntry[]>;

  readonly debugSummary: Signal<PaymentDebugSummary>;

  /**
   * Obtiene un snapshot del estado actual.
   * Preferir usar las signals directamente.
   */
  getSnapshot(): Readonly<PaymentsState>;

  /**
   * Suscribe a cambios de estado (patrón observer legacy).
   * Preferir usar signals con effect().
   *
   * @returns Función para cancelar suscripción
   */
  subscribe(listener: () => void): Unsubscribe;

  // ============================================================
  // ACCIONES DE PAGO
  // ============================================================

  /**
   * Inicia un nuevo pago.
   */
  startPayment(
    request: CreatePaymentRequest,
    providerId: PaymentProviderId,
    context?: StrategyContext,
  ): void;

  /**
   * Confirma un pago existente.
   */
  confirmPayment(request: ConfirmPaymentRequest, providerId: PaymentProviderId): void;

  /**
   * Cancela un pago existente.
   */
  cancelPayment(request: CancelPaymentRequest, providerId: PaymentProviderId): void;

  /**
   * Refresca el estado de un pago.
   */
  refreshPayment(request: GetPaymentStatusRequest, providerId: PaymentProviderId): void;

  // ============================================================
  // ACCIONES DE UI
  // ============================================================

  /**
   * Selecciona un provider.
   */
  selectProvider(providerId: PaymentProviderId): void;

  /**
   * Limpia el error actual.
   */
  clearError(): void;

  /**
   * Resetea el estado a inicial.
   */
  reset(): void;

  /**
   * Limpia el historial.
   */
  clearHistory(): void;

  // ============================================================
  // ACCIONES DE FALLBACK
  // ============================================================

  /**
   * Ejecuta un fallback con el provider seleccionado.
   */
  executeFallback(providerId: PaymentProviderId): void;

  /**
   * Cancela el fallback pendiente.
   */
  cancelFallback(): void;
}
