import { Observable } from "rxjs";
import { PaymentIntent, PaymentMethodType } from "../models/payment.types";
import { CreatePaymentRequest } from "../models/payment.requests";

/**
 * Resultado de preparación de una estrategia.
 * Contiene la información necesaria para que el cliente pueda proceder.
 */
export interface StrategyPrepareResult {
    /** Request modificado/enriquecido por la estrategia */
    preparedRequest: CreatePaymentRequest;
    /** Metadata adicional que la estrategia quiere adjuntar */
    metadata: Record<string, unknown>;
}

/**
 * Contexto de ejecución de la estrategia.
 * Permite pasar información adicional al flujo.
 */
export interface StrategyContext {
    /** URL de retorno después de 3DS o redirect */
    returnUrl?: string;
    /** URL de cancelación (para PayPal) */
    cancelUrl?: string;
    /** Indica si es un entorno de pruebas */
    isTest?: boolean;
    /** Información del dispositivo para antifraude */
    deviceData?: {
        ipAddress?: string;
        userAgent?: string;
        screenWidth?: number;
        screenHeight?: number;
    };
}

/**
 * Port para estrategias de pago.
 *
 * Cada estrategia implementa la lógica específica para un método de pago.
 * Esto incluye validaciones, transformaciones y manejo de flujos especiales.
 */
export interface PaymentStrategy {
    readonly type: PaymentMethodType;

    /**
     * Valida que el request sea válido para este método de pago.
     * @throws Error si la validación falla
     */
    validate(req: CreatePaymentRequest): void;

    /**
     * Prepara el request antes de enviarlo al gateway.
     * Puede enriquecer el request con datos específicos del método.
     */
    prepare(req: CreatePaymentRequest, context?: StrategyContext): StrategyPrepareResult;

    /**
     * Inicia el flujo de pago completo.
     * Combina validate → prepare → gateway.createIntent
     */
    start(req: CreatePaymentRequest, context?: StrategyContext): Observable<PaymentIntent>;

    /**
     * Indica si este método requiere acción adicional del usuario.
     * Por ejemplo: 3DS para tarjetas, redirección para PayPal, CLABE para SPEI.
     */
    requiresUserAction(intent: PaymentIntent): boolean;

    /**
     * Obtiene instrucciones específicas para el usuario basadas en el intent.
     */
    getUserInstructions(intent: PaymentIntent): string | null;
}
