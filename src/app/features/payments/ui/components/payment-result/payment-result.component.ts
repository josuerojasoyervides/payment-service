import { Component, input, output, computed, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, JsonPipe, DatePipe } from '@angular/common';
import { PaymentIntent, PaymentError, STATUS_BADGE_MAP } from '../../shared';
import { I18nService, I18nKeys } from '@core/i18n';

/**
 * Componente que muestra el resultado de un pago.
 * 
 * Puede mostrar un pago exitoso con detalles del intent,
 * o un error con mensaje y opción de reintentar.
 * 
 * @example
 * ```html
 * <app-payment-result
 *   [intent]="currentIntent()"
 *   [error]="currentError()"
 *   (retry)="resetPayment()"
 *   (newPayment)="startNewPayment()"
 * />
 * ```
 */
@Component({
    selector: 'app-payment-result',
    standalone: true,
    imports: [CommonModule, CurrencyPipe, JsonPipe],
    templateUrl: './payment-result.component.html',
})
export class PaymentResultComponent {
    private readonly i18n = inject(I18nService);

    /** Intent del pago (si fue exitoso) */
    readonly intent = input<PaymentIntent | null>(null);

    /** Error del pago (si falló) */
    readonly error = input<PaymentError | null>(null);

    /** Emite cuando el usuario quiere reintentar */
    readonly retry = output<void>();

    /** Emite cuando el usuario quiere hacer un nuevo pago */
    readonly newPayment = output<void>();

    /** Si hay un intent válido */
    readonly hasIntent = computed(() => this.intent() !== null);

    /** Si hay un error */
    readonly hasError = computed(() => this.error() !== null);

    /** Si el pago fue exitoso */
    readonly isSucceeded = computed(() => {
        const i = this.intent();
        return i !== null && i.status === 'succeeded';
    });

    /** Mensaje de error legible */
    readonly errorMessage = computed(() => {
        const e = this.error();
        if (!e) return this.i18n.t(I18nKeys.ui.payment_error);
        if (typeof e === 'object' && 'message' in e) {
            return (e as { message: string }).message;
        }
        return this.i18n.t(I18nKeys.ui.payment_error);
    });

    /** Código de error */
    readonly errorCode = computed(() => {
        const e = this.error();
        if (!e) return null;
        if (typeof e === 'object' && 'code' in e) {
            return (e as { code: string }).code;
        }
        return null;
    });

    /** Clase CSS del badge de estado */
    readonly statusBadgeClass = computed(() => {
        const i = this.intent();
        if (!i) return 'badge';
        return STATUS_BADGE_MAP[i.status] || 'badge';
    });

    /** Texto del estado */
    readonly statusText = computed(() => {
        const i = this.intent();
        if (!i) return '';
        // Para claves dinámicas, usamos string literal (no hay otra opción)
        const statusKey = `messages.status_${i.status}`;
        return this.i18n.has(statusKey) ? this.i18n.t(statusKey) : i.status;
    });

    // ===== Textos para el template (mantener lógica en el componente) =====
    get paymentErrorTitle(): string {
        return this.i18n.t(I18nKeys.ui.payment_error);
    }

    get errorCodeLabel(): string {
        return this.i18n.t(I18nKeys.ui.error_code);
    }

    get viewTechnicalDetailsLabel(): string {
        return this.i18n.t(I18nKeys.ui.view_technical_details);
    }

    get tryAgainLabel(): string {
        return this.i18n.t(I18nKeys.ui.try_again);
    }

    get paymentCompletedTitle(): string {
        return this.i18n.t(I18nKeys.ui.payment_completed);
    }

    get paymentStartedTitle(): string {
        return this.i18n.t(I18nKeys.ui.payment_started_successfully);
    }

    get intentIdLabel(): string {
        return this.i18n.t(I18nKeys.ui.intent_id);
    }

    get providerLabel(): string {
        return this.i18n.t(I18nKeys.ui.provider);
    }

    get statusLabel(): string {
        return this.i18n.t(I18nKeys.ui.status);
    }

    get amountLabel(): string {
        return this.i18n.t(I18nKeys.ui.amount);
    }

    get viewFullResponseLabel(): string {
        return this.i18n.t(I18nKeys.ui.view_full_response);
    }

    get newPaymentLabel(): string {
        return this.i18n.t(I18nKeys.ui.new_payment);
    }
}
