import { map, Observable, tap } from "rxjs";
import { PaymentStrategy, StrategyContext, StrategyPrepareResult } from "../../domain/ports/payment-strategy.port";
import { PaymentGateway } from "../../domain/ports/payment-gateway.port";
import { PaymentIntent, PaymentMethodType } from "../../domain/models/payment.types";
import { CreatePaymentRequest } from "../../domain/models/payment.requests";
import { NextActionSpei } from "../../domain/models/payment.actions";

/**
 * Estrategia para pagos via SPEI (Sistema de Pagos Electrónicos Interbancarios).
 *
 * Características:
 * - Solo disponible para MXN
 * - Genera CLABE y referencia para transferencia
 * - Tiempo de expiración configurable (default 72 horas)
 * - Requiere polling para verificar el pago
 * - Montos mínimos y máximos según regulación
 */
export class SpeiStrategy implements PaymentStrategy {
    readonly type: PaymentMethodType = 'spei';

    // Límites de SPEI según regulación mexicana
    private static readonly MIN_AMOUNT_MXN = 1;
    private static readonly MAX_AMOUNT_MXN = 8_000_000; // 8 millones MXN
    private static readonly DEFAULT_EXPIRY_HOURS = 72;

    // Bancos receptores comunes para SPEI
    private static readonly RECEIVING_BANKS: Record<string, string> = {
        'stripe': 'STP (Sistema de Transferencias y Pagos)',
        'conekta': 'STP (Sistema de Transferencias y Pagos)',
        'openpay': 'BBVA México',
    };

    constructor(private readonly gateway: PaymentGateway) { }

    /**
     * Valida el request para pagos SPEI.
     *
     * Reglas:
     * - Solo acepta MXN
     * - Monto entre 1 y 8,000,000 MXN
     * - No requiere token (a diferencia de tarjetas)
     */
    validate(req: CreatePaymentRequest): void {
        if (req.currency !== 'MXN') {
            throw new Error(`SPEI only supports MXN currency. Received: ${req.currency}`);
        }

        if (req.amount < SpeiStrategy.MIN_AMOUNT_MXN) {
            throw new Error(`Minimum amount for SPEI is ${SpeiStrategy.MIN_AMOUNT_MXN} MXN`);
        }

        if (req.amount > SpeiStrategy.MAX_AMOUNT_MXN) {
            throw new Error(
                `Maximum amount for SPEI is ${SpeiStrategy.MAX_AMOUNT_MXN.toLocaleString()} MXN. ` +
                `For larger amounts, consider wire transfer.`
            );
        }

        // SPEI no debe tener token
        if (req.method.token) {
            console.warn('[SpeiStrategy] Token provided but will be ignored for SPEI payments');
        }
    }

    /**
     * Prepara el request para SPEI.
     *
     * Enriquecimientos:
     * - Calcula fecha de expiración
     * - Genera concepto de pago estandarizado
     * - Prepara metadata para tracking
     */
    prepare(req: CreatePaymentRequest, context?: StrategyContext): StrategyPrepareResult {
        const expiryHours = SpeiStrategy.DEFAULT_EXPIRY_HOURS;
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + expiryHours);

        const metadata: Record<string, unknown> = {
            payment_method_type: 'spei',
            expires_at: expiresAt.toISOString(),
            expiry_hours: expiryHours,
            // Concepto de pago normalizado (SPEI tiene límite de caracteres)
            payment_concept: this.generatePaymentConcept(req.orderId),
            timestamp: new Date().toISOString(),
            requires_polling: true, // SPEI siempre requiere verificar el estado
        };

        // Request sin token para SPEI
        const preparedRequest: CreatePaymentRequest = {
            ...req,
            method: {
                type: 'spei',
                // Sin token
            },
        };

        return { preparedRequest, metadata };
    }

    /**
     * Inicia el flujo de pago SPEI.
     *
     * Flujo:
     * 1. Valida moneda y montos
     * 2. Prepara request y metadata
     * 3. Crea source/intent en el gateway
     * 4. Mapea respuesta con instrucciones SPEI
     */
    start(req: CreatePaymentRequest, context?: StrategyContext): Observable<PaymentIntent> {
        // 1. Validar
        this.validate(req);

        // 2. Preparar
        const { preparedRequest, metadata } = this.prepare(req, context);

        // 3. Log
        console.log(`[SpeiStrategy] Starting SPEI payment:`, {
            orderId: req.orderId,
            amount: req.amount,
            expiresAt: metadata['expires_at'],
        });

        // 4. Ejecutar y enriquecer respuesta
        return this.gateway.createIntent(preparedRequest).pipe(
            tap(intent => {
                console.log(`[SpeiStrategy] SPEI source created: ${intent.id}`);
            }),
            map(intent => this.enrichIntentWithSpeiInstructions(intent, req, metadata))
        );
    }

    /**
     * SPEI siempre requiere acción del usuario (realizar la transferencia).
     */
    requiresUserAction(intent: PaymentIntent): boolean {
        return intent.status === 'requires_action' &&
            intent.nextAction?.type === 'spei';
    }

    /**
     * Genera instrucciones detalladas para el usuario.
     */
    getUserInstructions(intent: PaymentIntent): string | null {
        if (!intent.nextAction || intent.nextAction.type !== 'spei') {
            return null;
        }

        const speiAction = intent.nextAction as NextActionSpei;

        return [
            `Para completar tu pago de $${intent.amount.toLocaleString()} ${intent.currency}:`,
            '',
            `1. Abre tu app bancaria o banca en línea`,
            `2. Selecciona "Transferencia SPEI"`,
            `3. Ingresa la CLABE: ${speiAction.clabe}`,
            `4. Monto exacto: $${speiAction.amount.toLocaleString()} ${speiAction.currency}`,
            `5. Referencia: ${speiAction.reference}`,
            `6. Beneficiario: ${speiAction.beneficiary}`,
            '',
            `⚠️ Fecha límite: ${new Date(speiAction.expiresAt).toLocaleString('es-MX')}`,
            '',
            `El pago puede tardar de 5 minutos a 24 horas en reflejarse.`,
        ].join('\n');
    }

    /**
     * Enriquece el intent con información SPEI completa.
     */
    private enrichIntentWithSpeiInstructions(
        intent: PaymentIntent,
        req: CreatePaymentRequest,
        metadata: Record<string, unknown>
    ): PaymentIntent {
        // Si el gateway ya retornó nextAction de tipo SPEI, usamos esa info
        // Si no, construimos una con datos simulados (en prod vendría del gateway)
        const existingSpei = intent.nextAction?.type === 'spei'
            ? intent.nextAction as NextActionSpei
            : null;

        const speiAction: NextActionSpei = {
            type: 'spei',
            instructions: this.getUserInstructions(intent) ?? 'Realiza la transferencia SPEI',
            clabe: existingSpei?.clabe ?? this.extractClabeFromRaw(intent),
            reference: existingSpei?.reference ?? this.generateReference(req.orderId),
            bank: existingSpei?.bank ?? SpeiStrategy.RECEIVING_BANKS[intent.provider] ?? 'STP',
            beneficiary: existingSpei?.beneficiary ?? 'Payment Service SA de CV',
            amount: req.amount,
            currency: req.currency,
            expiresAt: metadata['expires_at'] as string,
        };

        return {
            ...intent,
            status: 'requires_action',
            nextAction: speiAction,
        };
    }

    /**
     * Genera un concepto de pago válido para SPEI (máx 40 caracteres).
     */
    private generatePaymentConcept(orderId: string): string {
        const prefix = 'PAGO';
        const sanitizedOrderId = orderId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        return `${prefix} ${sanitizedOrderId}`.substring(0, 40);
    }

    /**
     * Genera una referencia numérica de 7 dígitos.
     */
    private generateReference(orderId: string): string {
        // En producción esto vendría del gateway
        // Aquí generamos una basada en el orderId para consistencia
        const hash = orderId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return String(hash % 10000000).padStart(7, '0');
    }

    /**
     * Intenta extraer la CLABE del raw response del gateway.
     */
    private extractClabeFromRaw(intent: PaymentIntent): string {
        const raw = intent.raw as any;

        // Stripe
        if (raw?.spei?.clabe) return raw.spei.clabe;

        // Conekta
        if (raw?.payment_method?.clabe) return raw.payment_method.clabe;

        // Fallback (en prod nunca debería llegar aquí)
        return '646180111812345678'; // CLABE de prueba STP
    }
}