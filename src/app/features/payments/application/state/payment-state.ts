import { Signal } from '@angular/core';
import { CancelPaymentRequest, ConfirmPaymentRequest, CreatePaymentRequest, GetPaymentStatusRequest } from '../../domain/models/payment.requests';
import { PaymentIntent, PaymentProviderId } from '../../domain/models/payment.types';
import { PaymentError } from '../../domain/models/payment.errors';
import { FallbackAvailableEvent, FallbackState } from '../../domain/models/fallback.types';
import { PaymentHistoryEntry, PaymentsState, PaymentStatus } from '../store/payments.models';

/**
 * Función para cancelar suscripción.
 */
export type Unsubscribe = () => void;

/**
 * Resumen de debug del estado.
 */
export interface PaymentDebugSummary {
    status: PaymentStatus;
    intentId: string | null;
    provider: PaymentProviderId | null;
    fallbackStatus: FallbackState['status'];
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
 * private readonly state = inject(PAYMENTS_STATE);
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

    /** Si hay un error */
    readonly hasError: Signal<boolean>;

    /** Intent actual si está disponible */
    readonly intent: Signal<PaymentIntent | null>;

    /** Error actual si existe */
    readonly error: Signal<PaymentError | null>;

    /** Provider actualmente seleccionado */
    readonly selectedProvider: Signal<PaymentProviderId | null>;

    // ============================================================
    // ESTADO DE FALLBACK
    // ============================================================

    /** Si hay un fallback pendiente de respuesta del usuario */
    readonly hasPendingFallback: Signal<boolean>;

    /** Evento de fallback pendiente (si existe) */
    readonly pendingFallbackEvent: Signal<FallbackAvailableEvent | null>;

    /** Estado completo del fallback */
    readonly fallbackState: Signal<FallbackState>;

    // ============================================================
    // HISTORIAL
    // ============================================================

    /** Número de entradas en el historial */
    readonly historyCount: Signal<number>;

    /** Última entrada del historial */
    readonly lastHistoryEntry: Signal<PaymentHistoryEntry | null>;

    /** Historial completo */
    readonly history: Signal<PaymentHistoryEntry[]>;

    // ============================================================
    // DEBUG
    // ============================================================

    /** Resumen del estado para debugging */
    readonly debugSummary: Signal<PaymentDebugSummary>;

    // ============================================================
    // SNAPSHOT (Para código imperativo/legacy)
    // ============================================================

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
    startPayment(request: CreatePaymentRequest, providerId: PaymentProviderId): void;

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
