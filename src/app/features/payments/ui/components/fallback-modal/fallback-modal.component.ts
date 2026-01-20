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
    template: `
        @if (open() && event()) {
            <div class="modal-overlay" (click)="onOverlayClick($event)">
                <div class="modal-content" (click)="$event.stopPropagation()">
                    <!-- Header -->
                    <div class="flex items-start gap-4 mb-6">
                        <div class="flex-shrink-0">
                            <div class="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                                <svg class="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                                </svg>
                            </div>
                        </div>
                        <div class="flex-1">
                            <h3 class="text-lg font-semibold text-gray-900">
                                Problema con el pago
                            </h3>
                            <p class="mt-1 text-gray-600">
                                <span class="font-medium capitalize">{{ event()!.failedProvider }}</span>
                                no está disponible en este momento.
                            </p>
                        </div>
                    </div>

                    <!-- Error info -->
                    @if (errorMessage()) {
                        <div class="bg-red-50 border border-red-100 rounded-lg p-3 mb-6 text-sm text-red-700">
                            {{ errorMessage() }}
                        </div>
                    }

                    <!-- Alternatives -->
                    <div class="mb-6">
                        <p class="text-sm text-gray-600 mb-3">
                            ¿Deseas intentar con otro proveedor?
                        </p>
                        
                        <div class="space-y-2">
                            @for (provider of alternativeProviders(); track provider.id) {
                                <button
                                    type="button"
                                    class="w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all"
                                    [class.border-blue-500]="selectedProvider() === provider.id"
                                    [class.bg-blue-50]="selectedProvider() === provider.id"
                                    [class.border-gray-200]="selectedProvider() !== provider.id"
                                    [class.hover:border-gray-300]="selectedProvider() !== provider.id"
                                    (click)="selectProvider(provider.id)"
                                >
                                    <span class="text-2xl">{{ provider.icon }}</span>
                                    <div class="text-left flex-1">
                                        <span class="font-medium text-gray-900">{{ provider.name }}</span>
                                        @if (provider.description) {
                                            <span class="text-sm text-gray-500 block">
                                                {{ provider.description }}
                                            </span>
                                        }
                                    </div>
                                    @if (selectedProvider() === provider.id) {
                                        <svg class="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                                        </svg>
                                    }
                                </button>
                            }
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="flex gap-3">
                        <button
                            type="button"
                            class="btn-secondary flex-1"
                            (click)="onCancel()"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            class="btn-primary flex-1"
                            [disabled]="!selectedProvider()"
                            [class.opacity-50]="!selectedProvider()"
                            [class.cursor-not-allowed]="!selectedProvider()"
                            (click)="onConfirm()"
                        >
                            Reintentar con {{ selectedProviderName() || '...' }}
                        </button>
                    </div>
                </div>
            </div>
        }
    `,
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
