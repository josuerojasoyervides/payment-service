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
        
        return {
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
                }
                
                patchState(store, {
                    fallback: INITIAL_FALLBACK_STATE,
                });
            },
            
            selectProvider(providerId: PaymentProviderId): void {
                patchState(store, { selectedProvider: providerId });
            },
            
            reset(): void {
                fallbackOrchestrator.reset();
                patchState(store, initialPaymentsState);
            },
            
            clearError(): void {
                patchState(store, { error: null, status: 'idle' });
            },
            
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
 * Store type for injection.
 */
export type PaymentsStoreType = InstanceType<typeof PaymentsStore>;
