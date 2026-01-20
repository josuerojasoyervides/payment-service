/**
 * Tipo para las traducciones.
 * 
 * Estructura jerárquica de claves de traducción.
 */
export interface Translations {
    errors: {
        // Errores generales
        provider_error: string;
        invalid_request: string;
        network_error: string;
        
        // Errores de tarjeta
        card_declined: string;
        expired_card: string;
        incorrect_cvc: string;
        incorrect_number: string;
        authentication_required: string;
        processing_error: string;
        
        // Errores de validación
        order_id_required: string;
        currency_required: string;
        amount_invalid: string;
        method_type_required: string;
        card_token_required: string;
        intent_id_required: string;
        min_amount: string;
        
        // Errores de proveedores
        stripe_error: string;
        paypal_error: string;
        stripe_unavailable: string;
        paypal_unavailable: string;
        
        // Errores de PayPal específicos
        paypal_invalid_request: string;
        paypal_permission_denied: string;
        paypal_resource_not_found: string;
        paypal_instrument_declined: string;
        paypal_order_not_approved: string;
        paypal_internal_error: string;
        paypal_auth_error: string;
    };
    
    messages: {
        // Mensajes informativos
        payment_created: string;
        payment_confirmed: string;
        payment_canceled: string;
        payment_processing: string;
        
        // Instrucciones
        bank_verification_required: string;
        spei_instructions: string;
        paypal_redirect_required: string;
        
        // Estados
        status_requires_payment_method: string;
        status_requires_confirmation: string;
        status_requires_action: string;
        status_processing: string;
        status_succeeded: string;
        status_failed: string;
        status_canceled: string;
    };
    
    ui: {
        // Componentes UI
        loading: string;
        error: string;
        success: string;
        cancel: string;
        confirm: string;
        retry: string;
        back: string;
        next: string;
        
        // Formularios
        select_provider: string;
        select_method: string;
        enter_amount: string;
        enter_order_id: string;
        
        // Fallback
        fallback_available: string;
        fallback_question: string;
        fallback_accept: string;
        fallback_cancel: string;
        fallback_auto_executing: string;
    };
}
