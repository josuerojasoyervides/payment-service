import { Component, input, signal, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { I18nService, I18nKeys } from '@core/i18n';
import { ClabeFormatPipe } from '@shared/pipes';

/**
 * Componente que muestra instrucciones para pago SPEI.
 * 
 * Incluye CLABE, referencia y monto con funcionalidad
 * de copiar al portapapeles.
 * 
 * @example
 * ```html
 * <app-spei-instructions
 *   [clabe]="'646180157000000001'"
 *   [reference]="'1234567'"
 *   [bank]="'STP'"
 *   [beneficiary]="'Mi Empresa'"
 *   [amount]="499.99"
 *   [currency]="'MXN'"
 *   [expiresAt]="'2024-01-20T12:00:00Z'"
 * />
 * ```
 */
@Component({
    selector: 'app-spei-instructions',
    standalone: true,
    imports: [CommonModule, CurrencyPipe, DatePipe, ClabeFormatPipe],
    templateUrl: './spei-instructions.component.html',
})
export class SpeiInstructionsComponent {
    private readonly i18n = inject(I18nService);

    /** CLABE interbancaria */
    readonly clabe = input.required<string>();

    /** Número de referencia */
    readonly reference = input.required<string>();

    /** Nombre del banco */
    readonly bank = input.required<string>();

    /** Nombre del beneficiario */
    readonly beneficiary = input<string>();

    /** Monto a transferir */
    readonly amount = input.required<number>();

    /** Código de moneda */
    readonly currency = input<string>('MXN');

    /** Fecha de expiración */
    readonly expiresAt = input<string>();

    /** Campo que acaba de ser copiado */
    readonly copiedField = signal<string | null>(null);

    // ===== Textos para el template =====
    get speiTransferTitle(): string {
        return this.i18n.t(I18nKeys.ui.spei_transfer);
    }

    get makeTransferText(): string {
        return this.i18n.t(I18nKeys.ui.make_transfer_with_data);
    }

    get copiedLabel(): string {
        return this.i18n.t(I18nKeys.ui.copied);
    }

    get copyLabel(): string {
        return this.i18n.t(I18nKeys.ui.copy);
    }

    get referenceLabel(): string {
        return this.i18n.t(I18nKeys.ui.reference);
    }

    get exactAmountLabel(): string {
        return this.i18n.t(I18nKeys.ui.exact_amount);
    }

    get destinationBankLabel(): string {
        return this.i18n.t(I18nKeys.ui.destination_bank);
    }

    get beneficiaryLabel(): string {
        return this.i18n.t(I18nKeys.ui.beneficiary);
    }

    get referenceExpiresText(): string {
        return this.i18n.t(I18nKeys.ui.reference_expires);
    }

    get transferExactAmountText(): string {
        return this.i18n.t(I18nKeys.ui.transfer_exact_amount);
    }

    get paymentMayTakeText(): string {
        return this.i18n.t(I18nKeys.ui.payment_may_take);
    }

    get keepReceiptText(): string {
        return this.i18n.t(I18nKeys.ui.keep_receipt);
    }

    /** Copia texto al portapapeles */
    async copyToClipboard(text: string, field: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(text);
            this.copiedField.set(field);

            // Resetear después de 2 segundos
            setTimeout(() => {
                if (this.copiedField() === field) {
                    this.copiedField.set(null);
                }
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }
}
