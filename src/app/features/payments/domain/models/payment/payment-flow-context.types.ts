/**
 * Contexto del flujo de pago.
 * 
 * Contiene información adicional que se pasa durante el flujo de pago,
 * como URLs de retorno, datos del dispositivo, y metadata.
 */
export interface PaymentFlowContext {
    /** URL de retorno después de 3DS o redirect */
    returnUrl?: string;
    
    /** URL de cancelación (para PayPal) */
    cancelUrl?: string;
    
    /** Indica si es un entorno de prueba */
    isTest?: boolean;
    
    /** Información del dispositivo para prevención de fraude */
    deviceData?: {
        ipAddress?: string;
        userAgent?: string;
        screenWidth?: number;
        screenHeight?: number;
    };
    
    /** Metadata adicional personalizada */
    metadata?: Record<string, unknown>;
}
