import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';
import type { PaymentMethodType } from '@payments/domain/models/payment/payment-intent.types';
import type { MethodOption } from '@payments/ui/shared/ui.types';
import { getDefaultMethods } from '@payments/ui/shared/ui.types';

@Component({
  selector: 'app-method-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './method-selector.component.html',
})
export class MethodSelectorComponent {
  private readonly i18n = inject(I18nService);

  readonly methods = input.required<PaymentMethodType[]>();
  readonly selected = input<PaymentMethodType | null>(null);
  readonly disabled = input<boolean>(false);

  readonly methodChange = output<PaymentMethodType>();

  readonly paymentMethodLabel = computed(() => this.i18n.t(I18nKeys.ui.payment_method_label));
  readonly selectProviderForMethodsText = computed(() =>
    this.i18n.t(I18nKeys.ui.select_provider_for_methods),
  );

  methodOptions(): MethodOption[] {
    const defaultMethods = getDefaultMethods(this.i18n);
    return this.methods()
      .map((type) => defaultMethods.find((m) => m.type === type))
      .filter((m): m is MethodOption => m !== undefined);
  }

  selectMethod(methodType: PaymentMethodType): void {
    if (!this.disabled() && methodType !== this.selected()) {
      this.methodChange.emit(methodType);
    }
  }
}
