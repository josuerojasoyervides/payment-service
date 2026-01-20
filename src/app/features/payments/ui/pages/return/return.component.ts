import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PAYMENT_STATE } from '../../../application/tokens/payment-state.token';
import { PaymentIntent, PaymentProviderId } from '../../../domain/models';
import { PaymentIntentCardComponent } from '../../components';

/**
 * Página de retorno para callbacks de 3DS y PayPal.
 * 
 * Esta página maneja los retornos de:
 * - 3D Secure authentication
 * - PayPal approval/cancel
 * 
 * Lee los query params para determinar el estado y
 * muestra el resultado apropiado.
 */
@Component({
    selector: 'app-return',
    standalone: true,
    imports: [CommonModule, RouterLink, PaymentIntentCardComponent],
    template: `
        <div class="min-h-screen bg-gray-50 py-8">
            <div class="max-w-xl mx-auto px-4">
                <!-- Header -->
                <div class="text-center mb-8">
                    @if (isCancel()) {
                        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </div>
                        <h1 class="text-2xl font-bold text-gray-900">Pago Cancelado</h1>
                        <p class="text-gray-600 mt-2">El proceso de pago fue cancelado</p>
                    } @else if (isSuccess()) {
                        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                        </div>
                        <h1 class="text-2xl font-bold text-gray-900">Pago Completado</h1>
                        <p class="text-gray-600 mt-2">Tu pago ha sido procesado exitosamente</p>
                    } @else {
                        <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg class="w-8 h-8 text-blue-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                        </div>
                        <h1 class="text-2xl font-bold text-gray-900">Verificando Pago</h1>
                        <p class="text-gray-600 mt-2">Estamos confirmando el estado de tu pago...</p>
                    }
                </div>

                <!-- Query Params Info -->
                <div class="card mb-6">
                    <h2 class="text-lg font-semibold mb-4">Información del Retorno</h2>
                    
                    <dl class="space-y-3 text-sm">
                        @if (intentId()) {
                            <div class="flex justify-between">
                                <dt class="text-gray-500">Intent ID</dt>
                                <dd class="font-mono text-gray-900">{{ intentId() }}</dd>
                            </div>
                        }
                        
                        @if (paypalToken()) {
                            <div class="flex justify-between">
                                <dt class="text-gray-500">PayPal Token</dt>
                                <dd class="font-mono text-gray-900">{{ paypalToken() }}</dd>
                            </div>
                        }
                        
                        @if (paypalPayerId()) {
                            <div class="flex justify-between">
                                <dt class="text-gray-500">PayPal Payer ID</dt>
                                <dd class="font-mono text-gray-900">{{ paypalPayerId() }}</dd>
                            </div>
                        }

                        <div class="flex justify-between">
                            <dt class="text-gray-500">Tipo de Flujo</dt>
                            <dd class="text-gray-900">{{ flowType() }}</dd>
                        </div>

                        <div class="flex justify-between">
                            <dt class="text-gray-500">Estado</dt>
                            <dd>
                                @if (isCancel()) {
                                    <span class="badge-error">Cancelado</span>
                                } @else if (isSuccess()) {
                                    <span class="badge-success">Completado</span>
                                } @else {
                                    <span class="badge-processing">Procesando</span>
                                }
                            </dd>
                        </div>
                    </dl>
                </div>

                <!-- Current Intent from State -->
                @if (currentIntent(); as intent) {
                    <div class="mb-6">
                        <h2 class="text-lg font-semibold mb-4">Estado del Pago</h2>
                        <app-payment-intent-card
                            [intent]="intent"
                            [showActions]="true"
                            (confirm)="confirmPayment($event)"
                            (refresh)="refreshPayment($event)"
                        />
                    </div>
                }

                <!-- Actions -->
                <div class="flex flex-col sm:flex-row gap-3">
                    <a routerLink="/payments/checkout" class="btn-primary flex-1 text-center">
                        @if (isCancel()) {
                            Reintentar Pago
                        } @else {
                            Nuevo Pago
                        }
                    </a>
                    
                    <a routerLink="/payments/history" class="btn-secondary flex-1 text-center">
                        Ver Historial
                    </a>
                </div>

                <!-- Debug -->
                <details class="mt-8">
                    <summary class="text-sm text-gray-500 cursor-pointer">
                        Ver todos los parámetros
                    </summary>
                    <pre class="mt-2 p-4 bg-gray-100 rounded-lg text-xs overflow-auto">{{ allParams() | json }}</pre>
                </details>
            </div>
        </div>
    `,
})
export class ReturnComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly paymentState = inject(PAYMENT_STATE);

    // Query params
    readonly intentId = signal<string | null>(null);
    readonly paypalToken = signal<string | null>(null);
    readonly paypalPayerId = signal<string | null>(null);
    readonly redirectStatus = signal<string | null>(null);
    readonly allParams = signal<Record<string, string>>({});

    // Route data
    readonly isReturnFlow = signal(false);
    readonly isCancelFlow = signal(false);

    // State
    readonly currentIntent = this.paymentState.intent;
    readonly isLoading = this.paymentState.isLoading;

    // Computed
    readonly isCancel = computed(() => {
        return this.isCancelFlow() || this.redirectStatus() === 'canceled';
    });

    readonly isSuccess = computed(() => {
        const intent = this.currentIntent();
        return intent?.status === 'succeeded' || this.redirectStatus() === 'succeeded';
    });

    readonly flowType = computed(() => {
        if (this.paypalToken()) return 'PayPal Redirect';
        if (this.intentId()) return '3D Secure';
        return 'Desconocido';
    });

    ngOnInit(): void {
        // Leer route data
        const data = this.route.snapshot.data;
        this.isReturnFlow.set(!!data['returnFlow']);
        this.isCancelFlow.set(!!data['cancelFlow']);

        // Leer query params
        const params = this.route.snapshot.queryParams;
        this.allParams.set(params);
        
        // Stripe params
        this.intentId.set(params['payment_intent'] || params['setup_intent'] || null);
        this.redirectStatus.set(params['redirect_status'] || null);
        
        // PayPal params
        this.paypalToken.set(params['token'] || null);
        this.paypalPayerId.set(params['PayerID'] || null);

        // Si tenemos un intent ID, intentar refrescar el estado
        const id = this.intentId() || this.paypalToken();
        if (id && !this.isCancelFlow()) {
            this.refreshPayment(id);
        }
    }

    confirmPayment(intentId: string): void {
        const provider = this.detectProvider();
        this.paymentState.confirmPayment({ intentId }, provider);
    }

    refreshPayment(intentId: string): void {
        const provider = this.detectProvider();
        this.paymentState.refreshPayment({ intentId }, provider);
    }

    private detectProvider(): PaymentProviderId {
        // Si hay token de PayPal, es PayPal
        if (this.paypalToken()) return 'paypal';
        // Por defecto, asumir Stripe
        return 'stripe';
    }
}
