/**
 * DTOs basados en la API real de PayPal Orders v2
 * @see https://developer.paypal.com/docs/api/orders/v2/
 */

export interface PaypalOrderDto {
    id: string;                          // 5O190127TN364715T
    status: PaypalOrderStatus;
    intent: 'CAPTURE' | 'AUTHORIZE';
    create_time: string;                 // ISO 8601
    update_time: string;

    // Links HATEOAS
    links: PaypalLink[];

    // Unidades de compra
    purchase_units: PaypalPurchaseUnit[];

    // Pagador (después de aprobación)
    payer?: PaypalPayer;

    // Información de pago (después de captura)
    payment_source?: PaypalPaymentSource;
}

export type PaypalOrderStatus =
    | 'CREATED'           // Orden creada, pendiente de aprobación
    | 'SAVED'             // Orden guardada
    | 'APPROVED'          // Aprobada por el pagador
    | 'VOIDED'            // Cancelada
    | 'COMPLETED'         // Capturada exitosamente
    | 'PAYER_ACTION_REQUIRED';  // Requiere acción del pagador

export interface PaypalLink {
    href: string;
    rel: 'self' | 'approve' | 'update' | 'capture' | 'payer-action';
    method: 'GET' | 'POST' | 'PATCH';
}

export interface PaypalPurchaseUnit {
    reference_id: string;
    description?: string;
    custom_id?: string;                  // Tu orderId
    invoice_id?: string;
    soft_descriptor?: string;

    amount: {
        currency_code: string;           // 'MXN', 'USD'
        value: string;                   // '100.00' (string!)
        breakdown?: {
            item_total?: PaypalMoney;
            shipping?: PaypalMoney;
            tax_total?: PaypalMoney;
            discount?: PaypalMoney;
        };
    };

    items?: PaypalItem[];

    // Después de captura
    payments?: {
        captures?: PaypalCapture[];
        authorizations?: PaypalAuthorization[];
    };
}

export interface PaypalMoney {
    currency_code: string;
    value: string;
}

export interface PaypalItem {
    name: string;
    quantity: string;
    unit_amount: PaypalMoney;
    description?: string;
    sku?: string;
    category?: 'DIGITAL_GOODS' | 'PHYSICAL_GOODS' | 'DONATION';
}

export interface PaypalPayer {
    payer_id: string;
    email_address?: string;
    name?: {
        given_name: string;
        surname: string;
    };
    address?: {
        country_code: string;
    };
}

export interface PaypalPaymentSource {
    paypal?: {
        account_id: string;
        email_address: string;
        name: {
            given_name: string;
            surname: string;
        };
    };
    card?: {
        brand: string;
        last_digits: string;
        type: 'CREDIT' | 'DEBIT';
    };
}

export interface PaypalCapture {
    id: string;
    status: 'COMPLETED' | 'DECLINED' | 'PARTIALLY_REFUNDED' | 'PENDING' | 'REFUNDED';
    amount: PaypalMoney;
    final_capture: boolean;
    create_time: string;
    update_time: string;
}

export interface PaypalAuthorization {
    id: string;
    status: 'CREATED' | 'CAPTURED' | 'DENIED' | 'EXPIRED' | 'PENDING' | 'VOIDED';
    amount: PaypalMoney;
    create_time: string;
    expiration_time: string;
}

export interface PaypalCreateOrderRequest {
    intent: 'CAPTURE' | 'AUTHORIZE';
    purchase_units: Array<{
        reference_id?: string;
        amount: {
            currency_code: string;
            value: string;
        };
        description?: string;
        custom_id?: string;
    }>;
    application_context?: {
        brand_name?: string;
        landing_page?: 'LOGIN' | 'BILLING' | 'NO_PREFERENCE';
        user_action?: 'PAY_NOW' | 'CONTINUE';
        return_url?: string;
        cancel_url?: string;
    };
}

export interface PaypalErrorResponse {
    name: string;                        // 'INVALID_REQUEST'
    message: string;
    debug_id: string;
    details?: Array<{
        field: string;
        value: string;
        location: string;
        issue: string;
        description: string;
    }>;
    links?: PaypalLink[];
}

// Helpers para extraer links
export function findPaypalLink(links: PaypalLink[], rel: PaypalLink['rel']): string | null {
    return links.find(l => l.rel === rel)?.href ?? null;
}
