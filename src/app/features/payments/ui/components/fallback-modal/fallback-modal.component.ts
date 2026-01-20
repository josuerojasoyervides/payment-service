import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentProviderId, FallbackAvailableEvent, DEFAULT_PROVIDERS } from '../../shared';

/**
 * Modal que muestra opciones de fallback cuando un proveedor falla.
 * 
 * Permite al usuario seleccionar un proveedor alternativo
 * o cancelar el proceso de fallback.
 * 
 * @example
 * ```html
 * <app-fallback-modal
 *   [event]="pendingFallbackEvent()"
 *   [open]="hasPendingFallback()"
 *   (confirm)="confirmFallback($event)"
 *   (cancel)="cancelFallback()"
 * />
 * ```
 */
@Component({
    selector: 'app-fallback-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './fallback-modal.component.html',
})
export class FallbackModalComponent {
    /** Evento de fallback pendiente */
    readonly event = input<FallbackAvailableEvent | null>(null);
    
    /** Si el modal está abierto */
    readonly open = input<boolean>(false);
    
    /** Emite cuando el usuario confirma el fallback */
    readonly confirm = output<PaymentProviderId>();
    
    /** Emite cuando el usuario cancela */
    readonly cancel = output<void>();

    /** Proveedor seleccionado */
    readonly selectedProvider = signal<PaymentProviderId | null>(null);

    /** Mensaje de error del evento */
    readonly errorMessage = computed(() => {
        const e = this.event();
        if (!e?.error) return null;
        if (typeof e.error === 'object' && 'message' in e.error) {
            return (e.error as { message: string }).message;
        }
        return null;
    });

    /** Proveedores alternativos con metadata */
    readonly alternativeProviders = computed(() => {
        const e = this.event();
        if (!e) return [];
        
        return e.alternativeProviders
            .map(id => DEFAULT_PROVIDERS.find(p => p.id === id))
            .filter((p): p is NonNullable<typeof p> => p !== undefined);
    });

    /** Nombre del proveedor seleccionado */
    readonly selectedProviderName = computed(() => {
        const id = this.selectedProvider();
        if (!id) return null;
        const provider = DEFAULT_PROVIDERS.find(p => p.id === id);
        return provider?.name ?? id;
    });

    selectProvider(providerId: PaymentProviderId): void {
        this.selectedProvider.set(providerId);
    }

    onConfirm(): void {
        const provider = this.selectedProvider();
        if (provider) {
            this.confirm.emit(provider);
            this.selectedProvider.set(null);
        }
    }

    onCancel(): void {
        this.cancel.emit();
        this.selectedProvider.set(null);
    }

    onOverlayClick(event: MouseEvent): void {
        // Solo cerrar si se hace clic en el overlay, no en el contenido
        if (event.target === event.currentTarget) {
            this.onCancel();
        }
    }
}
