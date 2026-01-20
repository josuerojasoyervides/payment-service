import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentMethodType, DEFAULT_METHODS, MethodOption } from '../../shared';

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
    template: `
        <div class="space-y-3">
            <label class="label">Método de pago</label>
            
            @if (methods().length === 0) {
                <p class="text-sm text-gray-500 italic">
                    Selecciona un proveedor para ver los métodos disponibles
                </p>
            } @else {
                <div class="flex flex-wrap gap-2">
                    @for (method of methodOptions(); track method.type) {
                        <button
                            type="button"
                            class="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all duration-200"
                            [class.border-blue-500]="selected() === method.type"
                            [class.bg-blue-50]="selected() === method.type"
                            [class.text-blue-700]="selected() === method.type"
                            [class.border-gray-200]="selected() !== method.type"
                            [class.hover:border-gray-300]="selected() !== method.type && !disabled()"
                            [class.opacity-50]="disabled()"
                            [class.cursor-not-allowed]="disabled()"
                            [disabled]="disabled()"
                            (click)="selectMethod(method.type)"
                        >
                            <span class="text-xl">{{ method.icon }}</span>
                            <div class="text-left">
                                <span class="font-medium">{{ method.name }}</span>
                                @if (method.description) {
                                    <span class="text-xs text-gray-500 block">
                                        {{ method.description }}
                                    </span>
                                }
                            </div>
                        </button>
                    }
                </div>
            }
        </div>
    `,
})
export class MethodSelectorComponent {
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
        return this.methods()
            .map(type => DEFAULT_METHODS.find(m => m.type === type))
            .filter((m): m is MethodOption => m !== undefined);
    }

    selectMethod(methodType: PaymentMethodType): void {
        if (!this.disabled() && methodType !== this.selected()) {
            this.methodChange.emit(methodType);
        }
    }
}
