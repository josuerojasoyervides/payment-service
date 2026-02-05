import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';
import { LoggerService } from '@core/logging';
import { SPEI_DISPLAY_CONFIG } from '@payments/presentation/tokens/spei-display-config.token';
import { ClabeFormatPipe } from '@shared/pipes/clabe-format.pipe';

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
 *   [bankCode]="'STP'"
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
  private readonly logger = inject(LoggerService);
  private readonly displayConfig = inject(SPEI_DISPLAY_CONFIG);

  /** Interbank CLABE */
  readonly clabe = input.required<string>();

  /** Reference number */
  readonly reference = input.required<string>();

  /** Bank code (SPEI) */
  readonly bankCode = input.required<string>();

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
  readonly speiTransferTitle = computed(() => this.i18n.t(I18nKeys.ui.spei_transfer));

  readonly makeTransferText = computed(() => this.i18n.t(I18nKeys.ui.make_transfer_with_data));

  readonly copiedLabel = computed(() => this.i18n.t(I18nKeys.ui.copied));

  readonly copyLabel = computed(() => this.i18n.t(I18nKeys.ui.copy));

  readonly referenceLabel = computed(() => this.i18n.t(I18nKeys.ui.reference));

  readonly exactAmountLabel = computed(() => this.i18n.t(I18nKeys.ui.exact_amount));

  readonly destinationBankLabel = computed(() => this.i18n.t(I18nKeys.ui.destination_bank));

  readonly beneficiaryLabel = computed(() => this.i18n.t(I18nKeys.ui.beneficiary));

  readonly referenceExpiresText = computed(() => this.i18n.t(I18nKeys.ui.reference_expires));

  readonly transferExactAmountText = computed(() => this.i18n.t(I18nKeys.ui.transfer_exact_amount));

  readonly paymentMayTakeText = computed(() => this.i18n.t(I18nKeys.ui.payment_may_take));

  readonly keepReceiptText = computed(() => this.i18n.t(I18nKeys.ui.keep_receipt));

  readonly bankDisplayName = computed(() => {
    const code = this.bankCode();
    return this.displayConfig.receivingBanks[code] ?? code;
  });

  /** Copies text to clipboard */
  async copyToClipboard(text: string, field: string): Promise<void> {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) return;
      await navigator.clipboard.writeText(text);
      this.copiedField.set(field);

      setTimeout(() => {
        if (this.copiedField() === field) {
          this.copiedField.set(null);
        }
      }, 2000);
    } catch (err) {
      this.logger.error('Failed to copy:', 'SpeiInstructionsComponent', err);
    }
  }
}
