import { Injectable } from "@angular/core";
import { delay, Observable, of } from "rxjs";
import { 
    PaymentIntent, 
    PaymentProviderId, 
    PaymentIntentStatus,
    CancelPaymentRequest, 
    ConfirmPaymentRequest, 
    CreatePaymentRequest, 
    GetPaymentStatusRequest,
} from "../../../domain/models";
import { PaymentGateway } from "../../../domain/ports";
import { StripePaymentIntentDto, StripeSpeiSourceDto } from "../../stripe/dto/stripe.dto";
import { PaypalOrderDto } from "../../paypal/dto/paypal.dto";

/**
 * Gateway fake para desarrollo y testing.
 *
 * Simula respuestas realistas de Stripe y PayPal.
 * Se comporta de forma diferente según el providerId que se le asigne.
 *
 * Características:
 * - Genera IDs únicos para cada request
 * - Simula delays de red (150-300ms)
 * - Respuestas en formato real de cada provider
 * - Simula diferentes flujos (3DS, SPEI, PayPal redirect)
 */
@Injectable()
export class FakePaymentGateway extends PaymentGateway {
    // Este campo será sobrescrito por la factory que lo use
    readonly providerId: PaymentProviderId = 'stripe';

    private static counter = 0;

    /**
     * Genera un ID único para simular IDs de provider.
     */
    private generateId(prefix: string): string {
        FakePaymentGateway.counter++;
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `${prefix}_fake_${timestamp}${random}`;
    }

    /**
     * Simula delay de red realista.
     */
    private simulateNetworkDelay<T>(data: T): Observable<T> {
        const delayMs = 150 + Math.random() * 150; // 150-300ms
        return of(data).pipe(delay(delayMs));
    }

    // ============ CREATE INTENT ============

    protected createIntentRaw(req: CreatePaymentRequest): Observable<any> {
        console.log(`[FakeGateway] Creating intent for ${this.providerId}`, req);

        // SPEI solo para Stripe
        if (req.method.type === 'spei') {
            return this.simulateNetworkDelay(this.createFakeSpeiSource(req));
        }

        // Para card, simular según provider
        if (this.providerId === 'paypal') {
            return this.simulateNetworkDelay(this.createFakePaypalOrder(req));
        }

        return this.simulateNetworkDelay(this.createFakeStripeIntent(req));
    }

    protected mapIntent(dto: any): PaymentIntent {
        // Detectar tipo de respuesta y mapear
        if ('object' in dto && dto.object === 'payment_intent') {
            return this.mapStripeIntent(dto as StripePaymentIntentDto);
        }
        if ('object' in dto && dto.object === 'source') {
            return this.mapStripeSpeiSource(dto as StripeSpeiSourceDto);
        }
        if ('intent' in dto && dto.intent === 'CAPTURE') {
            return this.mapPaypalOrder(dto as PaypalOrderDto);
        }

        // Fallback genérico
        return this.mapGeneric(dto);
    }

    // ============ CONFIRM INTENT ============

    protected confirmIntentRaw(req: ConfirmPaymentRequest): Observable<any> {
        console.log(`[FakeGateway] Confirming intent ${req.intentId}`);

        if (this.providerId === 'paypal') {
            return this.simulateNetworkDelay(this.createConfirmedPaypalOrder(req.intentId));
        }

        return this.simulateNetworkDelay(this.createConfirmedStripeIntent(req.intentId));
    }

    protected mapConfirmIntent(dto: any): PaymentIntent {
        return this.mapIntent(dto);
    }

    // ============ CANCEL INTENT ============

    protected cancelIntentRaw(req: CancelPaymentRequest): Observable<any> {
        console.log(`[FakeGateway] Canceling intent ${req.intentId}`);

        if (this.providerId === 'paypal') {
            return this.simulateNetworkDelay(this.createVoidedPaypalOrder(req.intentId));
        }

        return this.simulateNetworkDelay(this.createCanceledStripeIntent(req.intentId));
    }

    protected mapCancelIntent(dto: any): PaymentIntent {
        return this.mapIntent(dto);
    }

    // ============ GET INTENT ============

    protected getIntentRaw(req: GetPaymentStatusRequest): Observable<any> {
        console.log(`[FakeGateway] Getting status for ${req.intentId}`);

        if (this.providerId === 'paypal') {
            return this.simulateNetworkDelay(this.createFakePaypalOrderStatus(req.intentId));
        }

        return this.simulateNetworkDelay(this.createFakeStripeIntentStatus(req.intentId));
    }

    protected mapGetIntent(dto: any): PaymentIntent {
        return this.mapIntent(dto);
    }

    // ============ FAKE STRIPE RESPONSES ============

    private createFakeStripeIntent(req: CreatePaymentRequest): StripePaymentIntentDto {
        const intentId = this.generateId('pi');
        const amountInCents = Math.round(req.amount * 100);

        // Simular 3DS para ciertos tokens
        const requires3ds = req.method.token?.includes('3ds') ||
            req.method.token?.includes('auth') ||
            Math.random() > 0.7; // 30% de probabilidad

        return {
            id: intentId,
            object: 'payment_intent',
            amount: amountInCents,
            amount_received: 0,
            currency: req.currency.toLowerCase(),
            status: requires3ds ? 'requires_action' : 'requires_confirmation',
            client_secret: `${intentId}_secret_${this.generateId('sec')}`,
            created: Math.floor(Date.now() / 1000),
            livemode: false,
            metadata: {
                order_id: req.orderId,
            },
            payment_method: req.method.token ?? null,
            payment_method_types: ['card'],
            capture_method: 'automatic',
            confirmation_method: 'automatic',
            next_action: requires3ds ? {
                type: 'redirect_to_url',
                redirect_to_url: {
                    url: `https://hooks.stripe.com/3d_secure_2/authenticate/${intentId}`,
                    return_url: `${window.location.origin}/payments/return`,
                },
            } : null,
        };
    }

    private createFakeSpeiSource(req: CreatePaymentRequest): StripeSpeiSourceDto {
        const sourceId = this.generateId('src');
        const amountInCents = Math.round(req.amount * 100);

        // Generar CLABE fake pero realista (18 dígitos)
        const clabe = '646180' + Array.from({ length: 12 }, () =>
            Math.floor(Math.random() * 10)
        ).join('');

        // Referencia de 7 dígitos
        const reference = String(Math.floor(Math.random() * 10000000)).padStart(7, '0');

        // Expira en 72 horas
        const expiresAt = Math.floor(Date.now() / 1000) + (72 * 60 * 60);

        return {
            id: sourceId,
            object: 'source',
            amount: amountInCents,
            currency: req.currency.toLowerCase(),
            status: 'pending',
            type: 'spei',
            created: Math.floor(Date.now() / 1000),
            livemode: false,
            spei: {
                bank: 'STP',
                clabe,
                reference,
            },
            expires_at: expiresAt,
        };
    }

    private createConfirmedStripeIntent(intentId: string): StripePaymentIntentDto {
        return {
            id: intentId,
            object: 'payment_intent',
            amount: 10000,
            amount_received: 10000,
            currency: 'mxn',
            status: 'succeeded',
            client_secret: `${intentId}_secret_confirmed`,
            created: Math.floor(Date.now() / 1000) - 60,
            livemode: false,
            payment_method: 'pm_confirmed',
            payment_method_types: ['card'],
            capture_method: 'automatic',
            confirmation_method: 'automatic',
        };
    }

    private createCanceledStripeIntent(intentId: string): StripePaymentIntentDto {
        return {
            id: intentId,
            object: 'payment_intent',
            amount: 10000,
            amount_received: 0,
            currency: 'mxn',
            status: 'canceled',
            client_secret: `${intentId}_secret_canceled`,
            created: Math.floor(Date.now() / 1000) - 60,
            livemode: false,
            payment_method: null,
            payment_method_types: ['card'],
            capture_method: 'automatic',
            confirmation_method: 'automatic',
        };
    }

    private createFakeStripeIntentStatus(intentId: string): StripePaymentIntentDto {
        // Simular diferentes estados aleatorios
        const statuses: StripePaymentIntentDto['status'][] = [
            'requires_confirmation',
            'processing',
            'succeeded',
        ];
        const status = statuses[Math.floor(Math.random() * statuses.length)];

        return {
            id: intentId,
            object: 'payment_intent',
            amount: 10000,
            amount_received: status === 'succeeded' ? 10000 : 0,
            currency: 'mxn',
            status,
            client_secret: `${intentId}_secret_status`,
            created: Math.floor(Date.now() / 1000) - 120,
            livemode: false,
            payment_method: 'pm_existing',
            payment_method_types: ['card'],
            capture_method: 'automatic',
            confirmation_method: 'automatic',
        };
    }

    // ============ FAKE PAYPAL RESPONSES ============

    private createFakePaypalOrder(req: CreatePaymentRequest): PaypalOrderDto {
        const orderId = this.generateId('ORDER').toUpperCase();

        return {
            id: orderId,
            status: 'CREATED',
            intent: 'CAPTURE',
            create_time: new Date().toISOString(),
            update_time: new Date().toISOString(),
            links: [
                {
                    href: `https://api.sandbox.paypal.com/v2/checkout/orders/${orderId}`,
                    rel: 'self',
                    method: 'GET',
                },
                {
                    href: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`,
                    rel: 'approve',
                    method: 'GET',
                },
                {
                    href: `https://api.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`,
                    rel: 'capture',
                    method: 'POST',
                },
            ],
            purchase_units: [{
                reference_id: req.orderId,
                custom_id: req.orderId,
                description: `Orden ${req.orderId}`,
                amount: {
                    currency_code: req.currency,
                    value: req.amount.toFixed(2),
                },
            }],
        };
    }

    private createConfirmedPaypalOrder(orderId: string): PaypalOrderDto {
        const captureId = this.generateId('CAPTURE').toUpperCase();

        return {
            id: orderId,
            status: 'COMPLETED',
            intent: 'CAPTURE',
            create_time: new Date(Date.now() - 60000).toISOString(),
            update_time: new Date().toISOString(),
            links: [
                {
                    href: `https://api.sandbox.paypal.com/v2/checkout/orders/${orderId}`,
                    rel: 'self',
                    method: 'GET',
                },
            ],
            purchase_units: [{
                reference_id: 'order_demo',
                amount: {
                    currency_code: 'MXN',
                    value: '100.00',
                },
                payments: {
                    captures: [{
                        id: captureId,
                        status: 'COMPLETED',
                        amount: {
                            currency_code: 'MXN',
                            value: '100.00',
                        },
                        final_capture: true,
                        create_time: new Date().toISOString(),
                        update_time: new Date().toISOString(),
                    }],
                },
            }],
            payer: {
                payer_id: 'PAYER123456',
                email_address: 'buyer@example.com',
                name: {
                    given_name: 'Test',
                    surname: 'Buyer',
                },
            },
        };
    }

    private createVoidedPaypalOrder(orderId: string): PaypalOrderDto {
        return {
            id: orderId,
            status: 'VOIDED',
            intent: 'CAPTURE',
            create_time: new Date(Date.now() - 60000).toISOString(),
            update_time: new Date().toISOString(),
            links: [],
            purchase_units: [{
                reference_id: 'order_demo',
                amount: {
                    currency_code: 'MXN',
                    value: '100.00',
                },
            }],
        };
    }

    private createFakePaypalOrderStatus(orderId: string): PaypalOrderDto {
        // Simular orden aprobada (lista para capturar)
        return {
            id: orderId,
            status: 'APPROVED',
            intent: 'CAPTURE',
            create_time: new Date(Date.now() - 120000).toISOString(),
            update_time: new Date().toISOString(),
            links: [
                {
                    href: `https://api.sandbox.paypal.com/v2/checkout/orders/${orderId}`,
                    rel: 'self',
                    method: 'GET',
                },
                {
                    href: `https://api.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`,
                    rel: 'capture',
                    method: 'POST',
                },
            ],
            purchase_units: [{
                reference_id: 'order_demo',
                amount: {
                    currency_code: 'MXN',
                    value: '100.00',
                },
            }],
            payer: {
                payer_id: 'PAYER123456',
                email_address: 'buyer@example.com',
            },
        };
    }

    // ============ MAPPERS ============

    private mapStripeIntent(dto: StripePaymentIntentDto): PaymentIntent {
        const statusMap: Record<StripePaymentIntentDto['status'], PaymentIntentStatus> = {
            'requires_payment_method': 'requires_payment_method',
            'requires_confirmation': 'requires_confirmation',
            'requires_action': 'requires_action',
            'processing': 'processing',
            'requires_capture': 'processing',
            'canceled': 'canceled',
            'succeeded': 'succeeded',
        };

        return {
            id: dto.id,
            provider: 'stripe',
            status: statusMap[dto.status],
            amount: dto.amount / 100,
            currency: dto.currency.toUpperCase() as 'MXN' | 'USD',
            clientSecret: dto.client_secret,
            nextAction: dto.next_action ? {
                type: '3ds',
                clientSecret: dto.client_secret,
                returnUrl: dto.next_action.redirect_to_url?.return_url ?? '',
            } : undefined,
            raw: dto,
        };
    }

    private mapStripeSpeiSource(dto: StripeSpeiSourceDto): PaymentIntent {
        return {
            id: dto.id,
            provider: 'stripe',
            status: 'requires_action',
            amount: dto.amount / 100,
            currency: dto.currency.toUpperCase() as 'MXN' | 'USD',
            nextAction: {
                type: 'spei',
                instructions: 'Realiza una transferencia SPEI con los siguientes datos:',
                clabe: dto.spei.clabe,
                reference: dto.spei.reference,
                bank: dto.spei.bank,
                beneficiary: 'Payment Service (Fake)',
                amount: dto.amount / 100,
                currency: dto.currency.toUpperCase(),
                expiresAt: new Date(dto.expires_at * 1000).toISOString(),
            },
            raw: dto,
        };
    }

    private mapPaypalOrder(dto: PaypalOrderDto): PaymentIntent {
        const statusMap: Record<PaypalOrderDto['status'], PaymentIntentStatus> = {
            'CREATED': 'requires_action',
            'SAVED': 'requires_confirmation',
            'APPROVED': 'requires_confirmation',
            'VOIDED': 'canceled',
            'COMPLETED': 'succeeded',
            'PAYER_ACTION_REQUIRED': 'requires_action',
        };

        const purchaseUnit = dto.purchase_units[0];
        const approveLink = dto.links.find(l => l.rel === 'approve')?.href;

        return {
            id: dto.id,
            provider: 'paypal',
            status: statusMap[dto.status],
            amount: parseFloat(purchaseUnit?.amount?.value ?? '0'),
            currency: (purchaseUnit?.amount?.currency_code ?? 'MXN') as 'MXN' | 'USD',
            redirectUrl: approveLink,
            nextAction: approveLink ? {
                type: 'paypal_approve',
                approveUrl: approveLink,
                returnUrl: `${window.location.origin}/payments/return`,
                cancelUrl: `${window.location.origin}/payments/cancel`,
                paypalOrderId: dto.id,
            } : undefined,
            raw: dto,
        };
    }

    private mapGeneric(dto: any): PaymentIntent {
        return {
            id: dto.id ?? 'unknown',
            provider: this.providerId,
            status: dto.status ?? 'processing',
            amount: dto.amount ?? 0,
            currency: dto.currency ?? 'MXN',
            raw: dto,
        };
    }
}
