import { PaymentMethodType, PaymentProviderId } from "../models/payment.types";
import { PaymentGateway } from "./payment-gateway.port";
import { PaymentRequestBuilder, FieldRequirements } from "./payment-request-builder.port";
import { PaymentStrategy } from "./payment-strategy.port";

/**
 * Port para factories de proveedores de pago.
 *
 * Cada proveedor (Stripe, PayPal, etc.) implementa esta interfaz
 * para exponer su gateway, estrategias y builders.
 *
 * Patrón: Abstract Factory
 * - Crea familias de objetos relacionados (gateway + strategies + builders)
 * - Sin especificar sus clases concretas
 * 
 * La UI usa esta interfaz para:
 * 1. Saber qué métodos soporta el provider (getSupportedMethods)
 * 2. Saber qué campos necesita cada método (getFieldRequirements)
 * 3. Obtener el builder correcto (createRequestBuilder)
 */
export interface ProviderFactory {
    /** Identificador único del proveedor */
    readonly providerId: PaymentProviderId;

    /**
     * Retorna el gateway de este proveedor.
     * El gateway maneja la comunicación HTTP con la API del proveedor.
     */
    getGateway(): PaymentGateway;

    /**
     * Crea una estrategia para el tipo de método de pago.
     *
     * @param type Tipo de método de pago (card, spei, etc.)
     * @throws Error si el método no está soportado por este proveedor
     */
    createStrategy(type: PaymentMethodType): PaymentStrategy;

    /**
     * Verifica si este proveedor soporta un método de pago.
     *
     * Útil para mostrar opciones disponibles en la UI
     * o para validación antes de intentar crear una estrategia.
     */
    supportsMethod(type: PaymentMethodType): boolean;

    /**
     * Retorna la lista de métodos de pago soportados.
     */
    getSupportedMethods(): PaymentMethodType[];
    
    // ============================================================
    // NUEVOS MÉTODOS PARA BUILDERS
    // ============================================================
    
    /**
     * Crea un builder específico para este provider y método.
     * 
     * El builder retornado sabe exactamente qué campos necesita
     * y valida que estén presentes al hacer build().
     * 
     * @param type Tipo de método de pago
     * @returns Builder específico para esta combinación provider+method
     * @throws Error si el método no está soportado
     * 
     * @example
     * const factory = registry.get('paypal');
     * const builder = factory.createRequestBuilder('card');
     * const request = builder
     *     .forOrder('order_123')
     *     .withAmount(100, 'MXN')
     *     .withOptions({ returnUrl: 'https://...' })
     *     .build();
     */
    createRequestBuilder(type: PaymentMethodType): PaymentRequestBuilder;
    
    /**
     * Retorna los requisitos de campos para un método de pago.
     * 
     * La UI usa esto para:
     * - Renderizar el formulario con los campos correctos
     * - Mostrar qué campos son requeridos vs opcionales
     * - Auto-llenar campos como returnUrl con la URL actual
     * 
     * @param type Tipo de método de pago
     * @returns Configuración de campos necesarios
     * 
     * @example
     * const requirements = factory.getFieldRequirements('card');
     * // requirements.fields = [
     * //   { name: 'token', required: true, type: 'hidden', ... },
     * //   { name: 'saveForFuture', required: false, type: 'checkbox', ... }
     * // ]
     */
    getFieldRequirements(type: PaymentMethodType): FieldRequirements;
}
