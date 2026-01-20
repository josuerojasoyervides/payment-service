import { computed, inject } from '@angular/core';
import { 
    signalStore, 
    withState, 
    withComputed, 
    withMethods,
    patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';

import { 
    PaymentsState, 
    initialPaymentsState, 
    PaymentHistoryEntry,
    HISTORY_MAX_ENTRIES,
} from './payment.models';
import { 
    PaymentIntent, 
    PaymentProviderId, 
    PaymentError,
    CreatePaymentRequest, 
    ConfirmPaymentRequest, 
    CancelPaymentRequest, 
    GetPaymentStatusRequest,
    INITIAL_FALLBACK_STATE,
} from '../../domain/models';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { FallbackOrchestratorService } from '../services/fallback-orchestrator.service';

/**
 * Signal Store para el módulo de pagos.
 * 
 * Implementa estado reactivo con @ngrx/signals para:
 * - Estado inmutable por defecto
 * - Computed properties optimizadas
 * - Métodos para acciones
 * - Integración con RxJS para efectos
 * 
 * @example
 * ```typescript
 * @Component({...})
 * export class CheckoutComponent {
 *   readonly store = inject(PaymentsStore);
 *   
 *   readonly isLoading = this.store.isLoading;
 *   readonly intent = this.store.intent;
 *   readonly error = this.store.error;
 *   
 *   pay() {
 *     this.store.startPayment({ request, providerId: 'stripe' });
 *   }
 * }
 * ```
 */
/**
 * IMPORTANTE: Este store NO usa providedIn: 'root' porque depende de
 * servicios que solo están disponibles en el módulo lazy de payments.
 * Se provee en payments.routes.ts junto con el resto de providers.
 */
export const PaymentsStore = signalStore(
    // Estado inicial
    withState<PaymentsState>(initialPaymentsState),
    
    // Computed properties (selectores)
    withComputed((state) => ({
        /** Si hay un pago en proceso */
        isLoading: computed(() => state.status() === 'loading'),
        
        /** Si hay un pago completado exitosamente */
        isReady: computed(() => state.status() === 'ready'),
        
        /** Si hay un error */
        hasError: computed(() => state.status() === 'error'),
        
        /** Intent actual si está disponible */
        currentIntent: computed(() => state.intent()),
        
        /** Error actual si existe */
        currentError: computed(() => state.error()),
        
        /** Si hay un fallback pendiente */
        hasPendingFallback: computed(() => state.fallback().status === 'pending'),
        
        /** Si hay un auto-fallback en progreso */
        isAutoFallbackInProgress: computed(() => state.fallback().status === 'auto_executing'),
        
        /** Si hay cualquier tipo de fallback en ejecución */
        isFallbackExecuting: computed(() => 
            state.fallback().status === 'executing' || 
            state.fallback().status === 'auto_executing'
        ),
        
        /** Evento de fallback pendiente */
        pendingFallbackEvent: computed(() => state.fallback().pendingEvent),
        
        /** Si el fallback actual es automático */
        isAutoFallback: computed(() => state.fallback().isAutoFallback),
        
        /** Número de entradas en el historial */
        historyCount: computed(() => state.history().length),
        
        /** Último intent del historial */
        lastHistoryEntry: computed(() => {
            const history = state.history();
            return history.length > 0 ? history[history.length - 1] : null;
        }),
        
        /** Resumen del estado para debugging */
        debugSummary: computed(() => ({
            status: state.status(),
            intentId: state.intent()?.id ?? null,
            provider: state.selectedProvider(),
            fallbackStatus: state.fallback().status,
            isAutoFallback: state.fallback().isAutoFallback,
            historyCount: state.history().length,
        })),
    })),
    
    // Métodos (acciones)
    withMethods((store) => {
        const registry = inject(ProviderFactoryRegistry);
        const fallbackOrchestrator = inject(FallbackOrchestratorService);
        
        return {
            /**
             * Inicia un nuevo pago.
             */
            startPayment: rxMethod<{ request: CreatePaymentRequest; providerId: PaymentProviderId }>(
                pipe(
                    tap(({ providerId }) => {
                        patchState(store, {
                            status: 'loading',
                            error: null,
                            selectedProvider: providerId,
                        });
                    }),
                    switchMap(({ request, providerId }) => {
                        const factory = registry.get(providerId);
                        const strategy = factory.createStrategy(request.method.type);
                        
                        patchState(store, { currentRequest: request });
                        
                        return strategy.start(request).pipe(
                            tap((intent) => {
                                patchState(store, {
                                    status: 'ready',
                                    intent,
                                    error: null,
                                });
                                addToHistory(store, intent, providerId);
                                fallbackOrchestrator.notifySuccess();
                            }),
                            catchError((error: PaymentError) => {
                                patchState(store, {
                                    status: 'error',
                                    error,
                                    intent: null,
                                });
                                
                                // Intentar fallback
                                const hasFallback = fallbackOrchestrator.reportFailure(
                                    providerId,
                                    error,
                                    request
                                );
                                
                                if (hasFallback) {
                                    patchState(store, {
                                        fallback: fallbackOrchestrator.getSnapshot(),
                                    });
                                }
                                
                                return of(null);
                            })
                        );
                    })
                )
            ),
            
            /**
             * Confirma un pago existente.
             */
            confirmPayment: rxMethod<{ request: ConfirmPaymentRequest; providerId: PaymentProviderId }>(
                pipe(
                    tap(() => {
                        patchState(store, { status: 'loading', error: null });
                    }),
                    switchMap(({ request, providerId }) => {
                        const factory = registry.get(providerId);
                        const gateway = factory.getGateway();
                        
                        return gateway.confirmIntent(request).pipe(
                            tap((intent) => {
                                patchState(store, {
                                    status: 'ready',
                                    intent,
                                    error: null,
                                });
                                addToHistory(store, intent, providerId);
                            }),
                            catchError((error: PaymentError) => {
                                patchState(store, {
                                    status: 'error',
                                    error,
                                });
                                return of(null);
                            })
                        );
                    })
                )
            ),
            
            /**
             * Cancela un pago existente.
             */
            cancelPayment: rxMethod<{ request: CancelPaymentRequest; providerId: PaymentProviderId }>(
                pipe(
                    tap(() => {
                        patchState(store, { status: 'loading', error: null });
                    }),
                    switchMap(({ request, providerId }) => {
                        const factory = registry.get(providerId);
                        const gateway = factory.getGateway();
                        
                        return gateway.cancelIntent(request).pipe(
                            tap((intent) => {
                                patchState(store, {
                                    status: 'ready',
                                    intent,
                                    error: null,
                                });
                                addToHistory(store, intent, providerId);
                            }),
                            catchError((error: PaymentError) => {
                                patchState(store, {
                                    status: 'error',
                                    error,
                                });
                                return of(null);
                            })
                        );
                    })
                )
            ),
            
            /**
             * Obtiene el estado actual de un pago.
             */
            refreshPayment: rxMethod<{ request: GetPaymentStatusRequest; providerId: PaymentProviderId }>(
                pipe(
                    tap(() => {
                        patchState(store, { status: 'loading' });
                    }),
                    switchMap(({ request, providerId }) => {
                        const factory = registry.get(providerId);
                        const gateway = factory.getGateway();
                        
                        return gateway.getIntent(request).pipe(
                            tap((intent) => {
                                patchState(store, {
                                    status: 'ready',
                                    intent,
                                    error: null,
                                });
                            }),
                            catchError((error: PaymentError) => {
                                patchState(store, {
                                    status: 'error',
                                    error,
                                });
                                return of(null);
                            })
                        );
                    })
                )
            ),
            
            /**
             * Ejecuta un fallback con el provider seleccionado.
             */
            executeFallback(providerId: PaymentProviderId): void {
                const currentRequest = store.currentRequest();
                if (!currentRequest) {
                    console.warn('[PaymentsStore] No current request for fallback');
                    return;
                }
                
                // Usar el método startPayment existente
                this.startPayment({ request: currentRequest, providerId });
            },
            
            /**
             * Cancela el fallback pendiente.
             */
            cancelFallback(): void {
                const pendingEvent = store.fallback().pendingEvent;
                if (pendingEvent) {
                    fallbackOrchestrator.respondToFallback({
                        eventId: pendingEvent.eventId,
                        accepted: false,
                        timestamp: Date.now(),
                    });
                }
                
                patchState(store, {
                    fallback: INITIAL_FALLBACK_STATE,
                });
            },
            
            /**
             * Selecciona un provider.
             */
            selectProvider(providerId: PaymentProviderId): void {
                patchState(store, { selectedProvider: providerId });
            },
            
            /**
             * Resetea el estado a inicial.
             */
            reset(): void {
                fallbackOrchestrator.reset();
                patchState(store, initialPaymentsState);
            },
            
            /**
             * Limpia solo el error actual.
             */
            clearError(): void {
                patchState(store, { error: null, status: 'idle' });
            },
            
            /**
             * Limpia el historial.
             */
            clearHistory(): void {
                patchState(store, { history: [] });
            },
        };
    })
);

/**
 * Helper para agregar entrada al historial.
 */
function addToHistory(
    store: { history: () => PaymentHistoryEntry[] },
    intent: PaymentIntent,
    provider: PaymentProviderId,
    error?: PaymentError
): void {
    const entry: PaymentHistoryEntry = {
        intentId: intent.id,
        provider,
        status: intent.status,
        amount: intent.amount,
        currency: intent.currency,
        timestamp: Date.now(),
        error,
    };
    
    const currentHistory = store.history();
    const newHistory = [...currentHistory, entry].slice(-HISTORY_MAX_ENTRIES);
    
    patchState(store as any, { history: newHistory });
}

/**
 * Tipo del store para inyección.
 */
export type PaymentsStoreType = InstanceType<typeof PaymentsStore>;
