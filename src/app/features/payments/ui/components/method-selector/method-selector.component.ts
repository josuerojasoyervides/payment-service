import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentMethodType, getDefaultMethods, MethodOption } from '../../shared';
import { I18nService } from '@core/i18n';

/**
 * Componente selector de método de pago.
 * 
 * Muestra opciones de métodos de pago (tarjeta, SPEI, etc.)
 * filtradas según lo que soporte el proveedor seleccionado.
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
    
    /** Lista de métodos de pago disponibles */
    readonly methods = input.required<PaymentMethodType[]>();
    
    /** Método actualmente seleccionado */
    readonly selected = input<PaymentMethodType | null>(null);
    
    /** Si el selector está deshabilitado */
    readonly disabled = input<boolean>(false);
    
    /** Emite cuando se selecciona un método */
    readonly methodChange = output<PaymentMethodType>();

    /** Opciones de métodos con metadata */
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
}
