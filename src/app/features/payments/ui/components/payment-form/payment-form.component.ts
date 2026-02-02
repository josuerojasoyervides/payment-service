import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, input, output } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { PaymentOptions } from '@app/features/payments/domain/subdomains/payment/entities/payment-options.model';
import { I18nKeys, I18nPipe, I18nService } from '@core/i18n';
import type {
  FieldRequirement,
  FieldRequirements,
} from '@payments/presentation/contracts/checkout-field-requirements.types';
import { PaymentOptionsForm } from '@payments/ui/forms/payment-options/payment-options-form';
import { AutofocusDirective } from '@shared/directives/autofocus.directive';

/**
 * Dynamic payment form component.
 *
 * Automatically generates fields based on requirements
 * from the selected provider and payment method.
 *
 * @example
 * ```html
 * <app-payment-form
 *   [requirements]="fieldRequirements()"
 *   [disabled]="isLoading()"
 *   (formChange)="onFormChange($event)"
 *   (formValidChange)="onValidChange($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-payment-form',
  standalone: true,
  imports: [CommonModule, FormField, AutofocusDirective, I18nPipe],
  providers: [PaymentOptionsForm],
  templateUrl: './payment-form.component.html',
})
export class PaymentFormComponent {
  private readonly i18n = inject(I18nService);
  private readonly formEngine = inject(PaymentOptionsForm);

  /** Form field requirements */
  readonly requirements = input<FieldRequirements | null>(null);

  /** Whether the form is disabled */
  readonly disabled = input<boolean>(false);

  /** Emits when form values change */
  readonly formChange = output<PaymentOptions>();

  /** Emits when form validity changes */
  readonly formValidChange = output<boolean>();

  constructor() {
    effect(() => {
      this.formEngine.setRequirements(this.requirements());
    });

    effect(() => {
      this.formEngine.setDisabled(this.disabled());
    });

    effect(() => {
      this.formChange.emit(this.formEngine.paymentOptions());
      this.formValidChange.emit(this.formEngine.isValid());
    });
  }

  /** Visible fields (not hidden) */
  visibleFields(): FieldRequirement[] {
    const reqs = this.requirements();
    if (!reqs) return [];
    return reqs.fields.filter((f) => f.type !== 'hidden');
  }

  /** Hidden fields */
  hiddenFields(): FieldRequirement[] {
    const reqs = this.requirements();
    if (!reqs) return [];
    return reqs.fields.filter((f) => f.type === 'hidden');
  }

  textField(name: string) {
    return this.formEngine.textField(name);
  }

  flagField(name: string) {
    return this.formEngine.flagField(name);
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.formEngine.textField(fieldName);
    if (!field) return false;

    const state = field();
    return state.invalid() && state.touched();
  }

  markTextFieldTouched(fieldName: string): void {
    const field = this.formEngine.textField(fieldName);
    if (!field) return;
    field().markAsTouched();
  }

  hiddenFieldDisplayValue(fieldName: string): string {
    const model = this.formEngine.model();

    const flagValue = model.flags[fieldName];
    if (typeof flagValue === 'boolean') {
      return String(flagValue);
    }

    const raw = model.values[fieldName] ?? '';
    const trimmed = raw.trim();
    return trimmed ? trimmed : '(auto)';
  }

  readonly fieldRequiredText = computed(() => this.i18n.t(I18nKeys.ui.field_required));
  readonly selectProviderMethodText = computed(() =>
    this.i18n.t(I18nKeys.ui.select_provider_method),
  );
  readonly methodNoAdditionalDataText = computed(() =>
    this.i18n.t(I18nKeys.ui.method_no_additional_data),
  );
}
