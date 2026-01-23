import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';
import { ClabeFormatPipe } from '@shared/pipes';

/**
 * Component that displays SPEI payment instructions.
 *
 * Includes CLABE, reference and amount with clipboard
 * copy functionality.
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

  /** Interbank CLABE */
  readonly clabe = input.required<string>();

  /** Reference number */
  readonly reference = input.required<string>();

  /** Bank name */
  readonly bank = input.required<string>();

  /** Beneficiary name */
  readonly beneficiary = input<string>();

  /** Amount to transfer */
  readonly amount = input.required<number>();

  /** Currency code */
  readonly currency = input<string>('MXN');

  /** Expiration date */
  readonly expiresAt = input<string>();

  /** Field that was just copied */
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

  /** Copies text to clipboard */
  async copyToClipboard(text: string, field: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copiedField.set(field);

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
