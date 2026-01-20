import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentMethodType, getDefaultMethods, MethodOption } from '../../shared';
import { I18nService, I18nKeys } from '@core/i18n';

/**
 * Payment method selector component.
 * 
 * Displays payment method options (card, SPEI, etc.)
 * filtered by what the selected provider supports.
 * 
 * @example
 * ```html
 * <app-method-selector
 *   [methods]="['card', 'spei']"
 *   [selected]="selectedMethod()"
 *   [disabled]="isLoading()"
 *   (methodChange)="onMethodChange($event)"
 * />
 * ```
 */
@Component({
    selector: 'app-method-selector',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './method-selector.component.html',
})
export class MethodSelectorComponent {
    private readonly i18n = inject(I18nService);
    
    /** List of available payment methods */
    readonly methods = input.required<PaymentMethodType[]>();
    
    /** Currently selected method */
    readonly selected = input<PaymentMethodType | null>(null);
    
    /** Whether selector is disabled */
    readonly disabled = input<boolean>(false);
    
    /** Emits when a method is selected */
    readonly methodChange = output<PaymentMethodType>();

    /** Method options with metadata */
    methodOptions(): MethodOption[] {
        const defaultMethods = getDefaultMethods(this.i18n);
        return this.methods()
            .map(type => defaultMethods.find(m => m.type === type))
            .filter((m): m is MethodOption => m !== undefined);
    }

    selectMethod(methodType: PaymentMethodType): void {
        if (!this.disabled() && methodType !== this.selected()) {
            this.methodChange.emit(methodType);
        }
    }

    get paymentMethodLabel(): string {
        return this.i18n.t(I18nKeys.ui.payment_method_label);
    }

    get selectProviderForMethodsText(): string {
        return this.i18n.t(I18nKeys.ui.select_provider_for_methods);
    }
}
