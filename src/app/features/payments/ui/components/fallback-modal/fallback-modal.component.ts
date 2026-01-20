import { Component, input, output, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentProviderId, FallbackAvailableEvent, getDefaultProviders } from '../../shared';
import { I18nService, I18nKeys } from '@core/i18n';

/**
 * Modal that displays fallback options when a provider fails.
 * 
 * Allows user to select an alternative provider
 * or cancel the fallback process.
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
    
    /** Pending fallback event */
    readonly event = input<FallbackAvailableEvent | null>(null);
    
    /** Whether modal is open */
    readonly open = input<boolean>(false);
    
    /** Emits when user confirms fallback */
    readonly confirm = output<PaymentProviderId>();
    
    /** Emits when user cancels */
    readonly cancel = output<void>();

    /** Selected provider */
    readonly selectedProvider = signal<PaymentProviderId | null>(null);

    /** Track previous eventId to detect changes */
    private previousEventId: string | null = null;

    constructor() {
        // Reset selectedProvider when modal closes
        effect(() => {
            const isOpen = this.open();
            if (!isOpen) {
                this.selectedProvider.set(null);
            }
        });

        // Reset selectedProvider when eventId changes (new fallback event)
        effect(() => {
            const currentEvent = this.event();
            const currentEventId = currentEvent?.eventId ?? null;
            
            if (this.previousEventId !== null && currentEventId !== this.previousEventId) {
                // EventId changed - reset selection
                this.selectedProvider.set(null);
            }
            
            this.previousEventId = currentEventId;
        });
    }

    /** Error message from event */
    readonly errorMessage = computed(() => {
        const e = this.event();
        if (!e?.error) return null;
        if (typeof e.error === 'object' && 'message' in e.error) {
            return (e.error as { message: string }).message;
        }
        return null;
    });

    /** Alternative providers with metadata */
    readonly alternativeProviders = computed(() => {
        const e = this.event();
        if (!e) return [];
        const providers = getDefaultProviders(this.i18n);
        
        return e.alternativeProviders
            .map(id => providers.find(p => p.id === id))
            .filter((p): p is NonNullable<typeof p> => p !== undefined);
    });

    /** Selected provider name */
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
        if (event.target === event.currentTarget) {
            this.onCancel();
        }
    }
}
