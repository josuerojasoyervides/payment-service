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
    templateUrl: './provider-selector.component.html',
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
