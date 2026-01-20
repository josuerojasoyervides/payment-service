import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentProviderId, DEFAULT_PROVIDERS, ProviderOption } from '../../shared';

/**
 * Componente selector de proveedor de pago.
 * 
 * Muestra botones visuales para seleccionar entre Stripe, PayPal, etc.
 * 
 * @example
 * ```html
 * <app-provider-selector
 *   [providers]="['stripe', 'paypal']"
 *   [selected]="selectedProvider()"
 *   [disabled]="isLoading()"
 *   (providerChange)="onProviderChange($event)"
 * />
 * ```
 */
@Component({
    selector: 'app-provider-selector',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="space-y-3">
            <label class="label">Proveedor de pago</label>
            <div class="grid grid-cols-2 gap-3">
                @for (provider of providerOptions(); track provider.id) {
                    <button
                        type="button"
                        class="relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200"
                        [class.border-blue-500]="selected() === provider.id"
                        [class.bg-blue-50]="selected() === provider.id"
                        [class.border-gray-200]="selected() !== provider.id"
                        [class.hover:border-gray-300]="selected() !== provider.id && !disabled()"
                        [class.opacity-50]="disabled()"
                        [class.cursor-not-allowed]="disabled()"
                        [disabled]="disabled()"
                        (click)="selectProvider(provider.id)"
                    >
                        @if (selected() === provider.id) {
                            <div class="absolute top-2 right-2">
                                <svg class="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                                </svg>
                            </div>
                        }
                        
                        <span class="text-3xl mb-2">{{ provider.icon }}</span>
                        <span class="font-medium text-gray-900">{{ provider.name }}</span>
                        @if (provider.description) {
                            <span class="text-xs text-gray-500 mt-1 text-center">
                                {{ provider.description }}
                            </span>
                        }
                    </button>
                }
            </div>
        </div>
    `,
})
export class ProviderSelectorComponent {
    /** Lista de IDs de proveedores disponibles */
    readonly providers = input.required<PaymentProviderId[]>();
    
    /** Proveedor actualmente seleccionado */
    readonly selected = input<PaymentProviderId | null>(null);
    
    /** Si el selector está deshabilitado */
    readonly disabled = input<boolean>(false);
    
    /** Emite cuando se selecciona un proveedor */
    readonly providerChange = output<PaymentProviderId>();

    /** Opciones de proveedores con metadata */
    providerOptions(): ProviderOption[] {
        return this.providers()
            .map(id => DEFAULT_PROVIDERS.find(p => p.id === id))
            .filter((p): p is ProviderOption => p !== undefined);
    }

    selectProvider(providerId: PaymentProviderId): void {
        if (!this.disabled() && providerId !== this.selected()) {
            this.providerChange.emit(providerId);
        }
    }
}
