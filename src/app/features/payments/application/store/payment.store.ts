import { computed, effect, inject } from '@angular/core';
import { 
    signalStore, 
    withState, 
    withComputed, 
    withMethods,
    patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of, filter, takeUntil, Subject } from 'rxjs';

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
import { StrategyContext } from '../../domain/ports';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { FallbackOrchestratorService } from '../services/fallback-orchestrator.service';

/**
 * Signal Store for payments module.
 * 
 * Implements reactive state with @ngrx/signals for:
 * - Immutable state by default
 * - Optimized computed properties
 * - Methods for actions
 * - RxJS integration for effects
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
 * 
 * IMPORTANT: This store does NOT use providedIn: 'root' because it depends on
 * services that are only available in the lazy payments module.
 * It's provided in payments.routes.ts along with the rest of providers.
 */
export const PaymentsStore = signalStore(
    withState<PaymentsState>(initialPaymentsState),
    
    withComputed((state) => ({
        isLoading: computed(() => state.status() === 'loading'),
        
        isReady: computed(() => state.status() === 'ready'),
        
        hasError: computed(() => state.status() === 'error'),
        
        currentIntent: computed(() => state.intent()),
        
        currentError: computed(() => state.error()),
        
        hasPendingFallback: computed(() => state.fallback().status === 'pending'),
        
        isAutoFallbackInProgress: computed(() => state.fallback().status === 'auto_executing'),
        
        isFallbackExecuting: computed(() => 
            state.fallback().status === 'executing' || 
            state.fallback().status === 'auto_executing'
        ),
        
        pendingFallbackEvent: computed(() => state.fallback().pendingEvent),
        
        isAutoFallback: computed(() => state.fallback().isAutoFallback),
        
        historyCount: computed(() => state.history().length),
        
        lastHistoryEntry: computed(() => {
            const history = state.history();
            return history.length > 0 ? history[history.length - 1] : null;
        }),
        
        // Estados más descriptivos basados en el intent
        requiresUserAction: computed(() => {
            const intent = state.intent();
            return intent?.status === 'requires_action' || !!intent?.nextAction;
        }),
        
        isSucceeded: computed(() => {
            const intent = state.intent();
            return intent?.status === 'succeeded';
        }),
        
        isProcessing: computed(() => {
            const intent = state.intent();
            return intent?.status === 'processing';
        }),
        
        isFailed: computed(() => {
            const intent = state.intent();
            return intent?.status === 'failed';
        }),
        
        debugSummary: computed(() => ({
            status: state.status(),
            intentId: state.intent()?.id ?? null,
            provider: state.selectedProvider(),
            fallbackStatus: state.fallback().status,
            isAutoFallback: state.fallback().isAutoFallback,
            historyCount: state.history().length,
        })),
    })),
    
    withMethods((store) => {
        const registry = inject(ProviderFactoryRegistry);
        const fallbackOrchestrator = inject(FallbackOrchestratorService);
        
        // Suscribirse a fallbackExecute$ para ejecutar auto-fallback
        // Solo ejecutar si el estado es 'auto_executing' para evitar loops infinitos
        const destroy$ = new Subject<void>();
        
        return {
            startPayment: rxMethod<{ request: CreatePaymentRequest; providerId: PaymentProviderId; context?: StrategyContext }>(
                pipe(
                    tap(({ providerId }) => {
                        patchState(store, {
                            status: 'loading',
                            error: null,
                            selectedProvider: providerId,
                        });
                    }),
                    switchMap(({ request, providerId, context }) => {
                        const factory = registry.get(providerId);
                        const strategy = factory.createStrategy(request.method.type);
                        
                        patchState(store, { currentRequest: request });
                        
                        return strategy.start(request, context).pipe(
                            tap((intent) => {
                                patchState(store, {
                                    status: 'ready',
                                    intent,
                                    error: null,
                                });
                                addToHistory(store, intent, providerId);
                                fallbackOrchestrator.notifySuccess();
                                patchState(store, {
                                    fallback: fallbackOrchestrator.getSnapshot(),
                                });
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
                                
                                // Actualizar snapshot del fallback en cada transición
                                patchState(store, {
                                    fallback: fallbackOrchestrator.getSnapshot(),
                                });
                                
                                return of(null);
                            })
                        );
                    })
                )
            ),
            
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
            
            executeFallback(providerId: PaymentProviderId): void {
                const currentRequest = store.currentRequest();
                if (!currentRequest) {
                    console.warn('[PaymentsStore] No current request for fallback');
                    return;
                }
                
                this.startPayment({ request: currentRequest, providerId });
            },
            
            cancelFallback(): void {
                const pendingEvent = store.fallback().pendingEvent;
                if (pendingEvent) {
                    fallbackOrchestrator.respondToFallback({
                        eventId: pendingEvent.eventId,
                        accepted: false,
                        timestamp: Date.now(),
                    });
                    // Actualizar snapshot después de respondToFallback
                    patchState(store, {
                        fallback: fallbackOrchestrator.getSnapshot(),
                    });
                } else {
                    // Si no hay evento pendiente, resetear directamente
                    patchState(store, {
                        fallback: INITIAL_FALLBACK_STATE,
                    });
                }
            },
            
            selectProvider(providerId: PaymentProviderId): void {
                patchState(store, { selectedProvider: providerId });
            },
            
            reset(): void {
                fallbackOrchestrator.reset();
                patchState(store, {
                    ...initialPaymentsState,
                    fallback: fallbackOrchestrator.getSnapshot(),
                });
            },
            
            clearError(): void {
                patchState(store, { error: null, status: 'idle' });
            },
            
            clearHistory(): void {
                patchState(store, { history: [] });
            },
        };
    }),
    
    // Effect para suscribirse a fallbackExecute$ después de que los métodos estén disponibles
    withMethods((store) => {
        const fallbackOrchestrator = inject(FallbackOrchestratorService);
        const destroy$ = new Subject<void>();
        
        // Suscribirse a fallbackExecute$ para ejecutar auto-fallback
        // Solo ejecutar si el estado es 'auto_executing' para evitar loops infinitos
        fallbackOrchestrator.fallbackExecute$
            .pipe(
                takeUntil(destroy$),
                filter(() => store.fallback().status === 'auto_executing')
            )
            .subscribe(({ request, provider }) => {
                // Ejecutar el pago con el provider alternativo
                // Usar el método startPayment del store que ya está disponible
                (store as any).startPayment({ request, providerId: provider });
            });
        
        // Cleanup cuando el store se destruya
        effect(() => {
            return () => {
                destroy$.next();
                destroy$.complete();
            };
        });
        
        return {};
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
 * Store type for injection.
 */
export type PaymentsStoreType = InstanceType<typeof PaymentsStore>;
