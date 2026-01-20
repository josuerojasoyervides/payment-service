import { inject } from "@angular/core";
import { map, Observable, tap } from "rxjs";
import { 
    PaymentIntent, 
    PaymentMethodType, 
    CreatePaymentRequest,
    NextActionPaypalApprove,
} from "../../../domain/models";
import { 
    PaymentStrategy, 
    StrategyContext, 
    StrategyPrepareResult,
    PaymentGateway,
} from "../../../domain/ports";
import { findPaypalLink, PaypalOrderDto } from "../dto/paypal.dto";
import { I18nService } from "@core/i18n";

/**
 * Estrategia de redirección para PayPal.
 *
 * PayPal usa un flujo diferente a Stripe:
 * 1. Se crea una "Order" (no un PaymentIntent)
 * 2. El usuario es redirigido a PayPal para aprobar
 * 3. PayPal redirige de vuelta con el token
 * 4. Se captura el pago
 *
 * Esta estrategia maneja ese flujo completo.
 */
export class PaypalRedirectStrategy implements PaymentStrategy {
    readonly type: PaymentMethodType = 'card'; // PayPal procesa tarjetas via su checkout

    private static readonly DEFAULT_LANDING_PAGE = 'LOGIN';
    private static readonly DEFAULT_USER_ACTION = 'PAY_NOW';

    constructor(
        private readonly gateway: PaymentGateway,
        private readonly i18n: I18nService = inject(I18nService)
    ) { }

    /**
     * Valida el request para PayPal.
     *
     * PayPal tiene sus propias restricciones:
     * - Monedas soportadas: USD, MXN, EUR, etc.
     * - Montos mínimos varían por moneda
     */
    validate(req: CreatePaymentRequest): void {
        const supportedCurrencies = ['USD', 'MXN', 'EUR', 'GBP', 'CAD', 'AUD'];

        if (!supportedCurrencies.includes(req.currency)) {
            throw new Error(
                `PayPal does not support ${req.currency}. ` +
                `Supported currencies: ${supportedCurrencies.join(', ')}`
            );
        }

        // Montos mínimos por moneda
        const minAmounts: Record<string, number> = {
            USD: 1,
            MXN: 10,
            EUR: 1,
            GBP: 1,
            CAD: 1,
            AUD: 1,
        };

        const minAmount = minAmounts[req.currency] ?? 1;
        if (req.amount < minAmount) {
            throw new Error(`Minimum amount for PayPal in ${req.currency} is ${minAmount}`);
        }

        // PayPal no usa tokens de la misma forma - ignoramos si viene
        if (req.method.token) {
            console.warn('[PaypalRedirectStrategy] Token provided but PayPal uses its own checkout flow');
        }
    }

    /**
     * Prepara el request para PayPal.
     *
     * PayPal requiere:
     * - return_url y cancel_url obligatorios
     * - Configuración de landing page y user action
     * - Descripción del producto/servicio
     */
    prepare(req: CreatePaymentRequest, context?: StrategyContext): StrategyPrepareResult {
        const returnUrl = context?.returnUrl ?? `${window.location.origin}/payments/return`;
        const cancelUrl = context?.cancelUrl ?? `${window.location.origin}/payments/cancel`;

        const metadata: Record<string, unknown> = {
            payment_method_type: 'paypal_redirect',
            return_url: returnUrl,
            cancel_url: cancelUrl,
            landing_page: PaypalRedirectStrategy.DEFAULT_LANDING_PAGE,
            user_action: PaypalRedirectStrategy.DEFAULT_USER_ACTION,
            brand_name: 'Payment Service', // En prod vendría de configuración
            timestamp: new Date().toISOString(),

            // PayPal-specific: formatear monto como string con 2 decimales
            formatted_amount: req.amount.toFixed(2),
        };

        // Agregar info del dispositivo para PayPal Risk
        if (context?.deviceData) {
            metadata['paypal_client_metadata_id'] = this.generateClientMetadataId(context.deviceData);
        }

        return {
            preparedRequest: {
                ...req,
                // PayPal no necesita token, lo quitamos explícitamente
                method: { type: 'card' },
            },
            metadata,
        };
    }

    /**
     * Inicia el flujo de PayPal Checkout.
     *
     * Flujo:
     * 1. Valida el request
     * 2. Prepara con URLs de retorno
     * 3. Crea Order en PayPal via gateway
     * 4. Extrae approve URL de los links HATEOAS
     * 5. Retorna intent con nextAction de tipo paypal_approve
     */
    start(req: CreatePaymentRequest, context?: StrategyContext): Observable<PaymentIntent> {
        // 1. Validar
        this.validate(req);

        // 2. Preparar
        const { preparedRequest, metadata } = this.prepare(req, context);

        // 3. Log
        console.log(`[PaypalRedirectStrategy] Creating PayPal order:`, {
            orderId: req.orderId,
            amount: req.amount,
            currency: req.currency,
            returnUrl: metadata['return_url'],
        });

        // 4. Ejecutar y transformar a nuestro modelo
        return this.gateway.createIntent(preparedRequest).pipe(
            tap(intent => {
                console.log(`[PaypalRedirectStrategy] PayPal order created: ${intent.id}`);
            }),
            map(intent => this.enrichIntentWithPaypalApproval(intent, metadata))
        );
    }

    /**
     * PayPal siempre requiere acción del usuario (aprobar en PayPal).
     */
    requiresUserAction(intent: PaymentIntent): boolean {
        // PayPal siempre requiere redirección para aprobar
        return intent.status === 'requires_action' ||
            intent.nextAction?.type === 'paypal_approve' ||
            intent.nextAction?.type === 'redirect';
    }

    /**
     * Instrucciones para el usuario sobre el flujo de PayPal.
     */
    getUserInstructions(intent: PaymentIntent): string | null {
        if (intent.status === 'succeeded') {
            return null;
        }

        return [
            'Serás redirigido a PayPal para completar tu pago de forma segura.',
            '',
            'En PayPal podrás:',
            '• Pagar con tu cuenta PayPal',
            '• Pagar con tarjeta de crédito o débito',
            '• Usar PayPal Credit (si está disponible)',
            '',
            'Después de aprobar, regresarás automáticamente.',
        ].join('\n');
    }

    /**
     * Enriquece el intent con la información de aprobación de PayPal.
     */
    private enrichIntentWithPaypalApproval(
        intent: PaymentIntent,
        metadata: Record<string, unknown>
    ): PaymentIntent {
        // Extraer approve URL de la respuesta raw de PayPal
        const approveUrl = this.extractApproveUrl(intent);

        if (!approveUrl) {
            console.error('[PaypalRedirectStrategy] No approve URL found in PayPal response');
            // Fallback: usar redirectUrl si existe
            if (intent.redirectUrl) {
                return {
                    ...intent,
                    status: 'requires_action',
                    nextAction: {
                        type: 'redirect',
                        url: intent.redirectUrl,
                        returnUrl: metadata['return_url'] as string,
                    },
                };
            }
            return intent;
        }

        const paypalAction: NextActionPaypalApprove = {
            type: 'paypal_approve',
            approveUrl,
            returnUrl: metadata['return_url'] as string,
            cancelUrl: metadata['cancel_url'] as string,
            paypalOrderId: intent.id,
        };

        return {
            ...intent,
            status: 'requires_action',
            nextAction: paypalAction,
            // Guardar la URL también en redirectUrl por compatibilidad
            redirectUrl: approveUrl,
        };
    }

    /**
     * Extrae la URL de aprobación de la respuesta de PayPal.
     */
    private extractApproveUrl(intent: PaymentIntent): string | null {
        const raw = intent.raw as PaypalOrderDto | undefined;

        // Buscar en links HATEOAS (forma correcta de PayPal)
        if (raw?.links) {
            const approveLink = findPaypalLink(raw.links, 'approve');
            if (approveLink) return approveLink;

            // Fallback a payer-action
            const payerActionLink = findPaypalLink(raw.links, 'payer-action');
            if (payerActionLink) return payerActionLink;
        }

        // Fallback: buscar en redirectUrl directo
        if (intent.redirectUrl?.includes('paypal.com')) {
            return intent.redirectUrl;
        }

        return null;
    }

    /**
     * Genera un client metadata ID para PayPal Risk/Fraud.
     */
    private generateClientMetadataId(deviceData: NonNullable<StrategyContext['deviceData']>): string {
        const data = [
            deviceData.ipAddress ?? 'unknown',
            deviceData.userAgent ?? 'unknown',
            Date.now().toString(36),
        ].join('|');

        // Simple hash (en prod usarías algo más robusto)
        return btoa(data).substring(0, 32);
    }
}