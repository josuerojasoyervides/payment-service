import { CurrencyCode } from '../../models/payment/payment-intent.types';
import { CreatePaymentRequest } from '../../models/payment/payment-request.types';

/**
 * Opciones genéricas para el builder.
 * 
 * Contiene TODOS los campos posibles que cualquier provider podría necesitar.
 * Cada builder específico usa los que necesita y valida los requeridos.
 */
export interface PaymentOptions {
    token?: string;           // Card token (Stripe)
    returnUrl?: string;       // Redirect URL (PayPal)
    cancelUrl?: string;       // Cancel URL (PayPal)
    customerEmail?: string;   // Email (SPEI, OXXO)
    saveForFuture?: boolean;  // Guardar método (Stripe)
}

/**
 * Interface base para builders de payment requests.
 * 
 * Esta es la ABSTRACCIÓN que la UI conoce.
 * Infrastructure provee las IMPLEMENTACIONES específicas.
 * 
 * La UI nunca importa de infrastructure, solo usa esta interface.
 */
export interface PaymentRequestBuilder {
    /**
     * Asigna el ID de la orden.
     */
    forOrder(orderId: string): this;
    
    /**
     * Asigna monto y moneda.
     */
    withAmount(amount: number, currency: CurrencyCode): this;
    
    /**
     * Asigna opciones específicas del método de pago.
     * 
     * La UI pasa todas las opciones que tiene disponibles.
     * El builder usa las que necesita y valida las requeridas.
     */
    withOptions(options: PaymentOptions): this;
    
    /**
     * Construye el request final.
     * 
     * @throws Error si faltan campos requeridos para este provider/method
     */
    build(): CreatePaymentRequest;
}

// ============================================================
// FIELD REQUIREMENTS - Para que la UI sepa qué campos mostrar
// ============================================================

/**
 * Tipos de campo soportados en el formulario.
 */
export type FieldType = 'text' | 'email' | 'hidden' | 'url';

/**
 * Configuración de un campo del formulario de pago.
 */
export interface FieldConfig {
    /** Nombre del campo (key en PaymentOptions) */
    name: keyof PaymentOptions;
    
    /** Label para mostrar en UI */
    label: string;
    
    /** Si es requerido para este provider/method */
    required: boolean;
    
    /** Tipo de input */
    type: FieldType;
    
    /** Placeholder para el input */
    placeholder?: string;
    
    /** Valor por defecto */
    defaultValue?: string;
    
    /** 
     * Si es 'hidden', la UI debe proveerlo pero no mostrarlo.
     * Ej: returnUrl puede ser la URL actual
     */
    autoFill?: 'currentUrl' | 'none';
}

/**
 * Requisitos de campos para un provider/method específico.
 * 
 * La UI consulta esto ANTES de renderizar el formulario
 * para saber qué campos mostrar.
 */
export interface FieldRequirements {
    /** Campos que este provider/method necesita */
    fields: FieldConfig[];
    
    /** Descripción del método de pago para la UI */
    description?: string;
    
    /** Instrucciones adicionales para el usuario */
    instructions?: string;
}
