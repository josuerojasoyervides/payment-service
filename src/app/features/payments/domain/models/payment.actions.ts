export type NextAction =
    | NextActionRedirect
    | NextActionSpei
    | NextActionThreeDs
    | NextActionPaypalApprove;

/**
 * Redirección genérica a una URL externa.
 */
export interface NextActionRedirect {
    type: 'redirect';
    url: string;
    returnUrl?: string;
}

/**
 * Transferencia SPEI - requiere que el usuario realice la transferencia manualmente.
 */
export interface NextActionSpei {
    type: 'spei';
    /** Instrucciones legibles para el usuario */
    instructions: string;
    /** CLABE de 18 dígitos */
    clabe: string;
    /** Referencia numérica para el concepto */
    reference: string;
    /** Banco receptor */
    bank: string;
    /** Beneficiario */
    beneficiary: string;
    /** Monto exacto a transferir */
    amount: number;
    /** Moneda */
    currency: string;
    /** Fecha/hora límite para realizar el pago (ISO 8601) */
    expiresAt: string;
}

/**
 * 3D Secure - autenticación adicional del tarjetahabiente.
 */
export interface NextActionThreeDs {
    type: '3ds';
    /** Client secret para Stripe.js */
    clientSecret: string;
    /** URL de retorno después de 3DS */
    returnUrl: string;
    /** Versión de 3DS (1.0, 2.0, 2.1, 2.2) */
    threeDsVersion?: string;
}

/**
 * PayPal - requiere aprobación del usuario en PayPal.
 */
export interface NextActionPaypalApprove {
    type: 'paypal_approve';
    /** URL para redirigir al usuario a PayPal */
    approveUrl: string;
    /** URL de retorno después de aprobar */
    returnUrl: string;
    /** URL si el usuario cancela en PayPal */
    cancelUrl: string;
    /** ID de la orden en PayPal */
    paypalOrderId: string;
}