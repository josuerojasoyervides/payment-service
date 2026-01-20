import { map, Observable, tap } from "rxjs";
import { 
    PaymentStrategy, 
    StrategyContext, 
    StrategyPrepareResult,
    PaymentGateway,
    TokenValidator, 
    NullTokenValidator,
} from "../../domain/ports";
import { PaymentIntent, PaymentMethodType, CreatePaymentRequest } from "../../domain/models";

/**
 * Estrategia para pagos con tarjeta de crédito/débito.
 *
 * Características:
 * - Validación de token delegada al TokenValidator del proveedor
 * - Soporte para 3D Secure (autenticación adicional)
 * - Manejo de tarjetas guardadas vs tokenizadas
 * - Metadata de dispositivo para antifraude
 * 
 * Esta estrategia es compartida entre proveedores, pero la validación
 * de tokens es específica de cada uno gracias al TokenValidator inyectado.
 */
export class CardStrategy implements PaymentStrategy {
    readonly type: PaymentMethodType = 'card';

    /** Patrón genérico para detectar tarjetas guardadas (PaymentMethod) */
    private static readonly SAVED_CARD_PATTERN = /^pm_[a-zA-Z0-9]+$/;

    constructor(
        private readonly gateway: PaymentGateway,
        private readonly tokenValidator: TokenValidator = new NullTokenValidator()
    ) { }

    /**
     * Valida el request para pagos con tarjeta.
     *
     * Reglas:
     * - Token es obligatorio si el proveedor lo requiere (delegado a TokenValidator)
     * - Monto mínimo de 10 MXN / 1 USD
     */
    validate(req: CreatePaymentRequest): void {
        // Delegar validación de token al validador del proveedor
        if (this.tokenValidator.requiresToken()) {
            if (!req.method.token) {
                throw new Error('Card token is required for card payments');
            }
            this.tokenValidator.validate(req.method.token);
        }

        const minAmount = req.currency === 'MXN' ? 10 : 1;
        if (req.amount < minAmount) {
            throw new Error(`Minimum amount for card payments is ${minAmount} ${req.currency}`);
        }
    }

    /**
     * Prepara el request para el gateway.
     *
     * Enriquecimientos:
     * - Agrega metadata de dispositivo para antifraude
     * - Detecta si es tarjeta guardada para aplicar SCA
     * - Configura return_url para 3DS
     */
    prepare(req: CreatePaymentRequest, context?: StrategyContext): StrategyPrepareResult {
        const isSavedCard = CardStrategy.SAVED_CARD_PATTERN.test(req.method.token!);

        const metadata: Record<string, unknown> = {
            payment_method_type: 'card',
            is_saved_card: isSavedCard,
            requires_sca: isSavedCard, // Strong Customer Authentication para tarjetas guardadas
            timestamp: new Date().toISOString(),
        };

        // Agregar datos del dispositivo si están disponibles
        if (context?.deviceData) {
            metadata['device_ip'] = context.deviceData.ipAddress;
            metadata['device_user_agent'] = context.deviceData.userAgent;
            metadata['device_screen'] = context.deviceData.screenWidth && context.deviceData.screenHeight
                ? `${context.deviceData.screenWidth}x${context.deviceData.screenHeight}`
                : undefined;
        }

        // Agregar return_url para 3DS
        if (context?.returnUrl) {
            metadata['return_url'] = context.returnUrl;
        }

        return {
            preparedRequest: {
                ...req,
                // Podríamos enriquecer el request aquí si necesitáramos
            },
            metadata,
        };
    }

    /**
     * Inicia el flujo de pago con tarjeta.
     *
     * Flujo:
     * 1. Valida el request
     * 2. Prepara metadata y enriquecimientos
     * 3. Crea el intent en el gateway
     * 4. Detecta si requiere 3DS
     */
    start(req: CreatePaymentRequest, context?: StrategyContext): Observable<PaymentIntent> {
        // 1. Validar
        this.validate(req);

        // 2. Preparar
        const { preparedRequest, metadata } = this.prepare(req, context);

        // 3. Log para debugging (en prod sería telemetría)
        console.log(`[CardStrategy] Starting payment:`, {
            orderId: req.orderId,
            amount: req.amount,
            currency: req.currency,
            tokenPrefix: req.method.token?.substring(0, 6),
            metadata,
        });

        // 4. Ejecutar y procesar respuesta
        return this.gateway.createIntent(preparedRequest).pipe(
            tap(intent => {
                if (this.requiresUserAction(intent)) {
                    console.log(`[CardStrategy] 3DS required for intent ${intent.id}`);
                }
            }),
            map(intent => this.enrichIntentWith3dsInfo(intent, context))
        );
    }

    /**
     * Determina si el intent requiere acción del usuario (3DS).
     */
    requiresUserAction(intent: PaymentIntent): boolean {
        return intent.status === 'requires_action' &&
            intent.nextAction?.type === '3ds';
    }

    /**
     * Genera instrucciones para el usuario si hay 3DS pendiente.
     */
    getUserInstructions(intent: PaymentIntent): string | null {
        if (!this.requiresUserAction(intent)) {
            return null;
        }

        return 'Tu banco requiere verificación adicional. ' +
            'Serás redirigido a una página segura para completar la autenticación.';
    }

    /**
     * Enriquece el intent con información de 3DS si aplica.
     */
    private enrichIntentWith3dsInfo(intent: PaymentIntent, context?: StrategyContext): PaymentIntent {
        if (intent.status !== 'requires_action' || !intent.clientSecret) {
            return intent;
        }

        // Si el intent requiere acción y tiene client_secret, es 3DS
        return {
            ...intent,
            nextAction: {
                type: '3ds',
                clientSecret: intent.clientSecret,
                returnUrl: context?.returnUrl ?? window.location.href,
                threeDsVersion: '2.0', // Asumimos 3DS 2.0 moderno
            },
        };
    }
}