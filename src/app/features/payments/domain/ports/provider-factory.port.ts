import { PaymentMethodType, PaymentProviderId } from "../models/payment.types";
import { PaymentGateway } from "./payment-gateway.port";
import { PaymentStrategy } from "./payment-strategy.port";

/**
 * Port para factories de proveedores de pago.
 *
 * Cada proveedor (Stripe, PayPal, etc.) implementa esta interfaz
 * para exponer su gateway y estrategias de pago.
 *
 * Patrón: Abstract Factory
 * - Crea familias de objetos relacionados (gateway + strategies)
 * - Sin especificar sus clases concretas
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
    supportsMethod?(type: PaymentMethodType): boolean;

    /**
     * Retorna la lista de métodos de pago soportados.
     */
    getSupportedMethods?(): PaymentMethodType[];
}
