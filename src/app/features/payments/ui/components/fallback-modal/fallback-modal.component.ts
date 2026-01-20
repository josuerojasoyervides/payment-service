import { Component, input, output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentProviderId, FallbackAvailableEvent, getDefaultProviders } from '../../shared';
import { I18nService, I18nKeys } from '@core/i18n';

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
    private readonly i18n = inject(I18nService);
    
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
        const providers = getDefaultProviders(this.i18n);
        
        return e.alternativeProviders
            .map(id => providers.find(p => p.id === id))
            .filter((p): p is NonNullable<typeof p> => p !== undefined);
    });

    /** Nombre del proveedor seleccionado */
    readonly selectedProviderName = computed(() => {
        const id = this.selectedProvider();
        if (!id) return null;
        const providers = getDefaultProviders(this.i18n);
        const provider = providers.find(p => p.id === id);
        return provider?.name ?? id;
    });

    // ===== Textos para el template =====
    get paymentProblemTitle(): string {
        return this.i18n.t(I18nKeys.ui.payment_problem);
    }

    get providerUnavailableText(): string {
        return this.i18n.t(I18nKeys.ui.provider_unavailable);
    }

    get tryAnotherProviderText(): string {
        return this.i18n.t(I18nKeys.ui.try_another_provider);
    }

    get cancelLabel(): string {
        return this.i18n.t(I18nKeys.ui.cancel);
    }

    get retryWithLabel(): string {
        return this.i18n.t(I18nKeys.ui.retry_with);
    }

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
