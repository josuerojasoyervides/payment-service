import { CurrencyCode } from '../../models/payment/payment-intent.types';
import { CreatePaymentRequest } from '../../models/payment/payment-request.types';

/**
 * Generic options for the builder.
 * 
 * Contains ALL possible fields that any provider might need.
 * Each specific builder uses what it needs and validates required ones.
 */
export interface PaymentOptions {
    token?: string;
    returnUrl?: string;
    cancelUrl?: string;
    customerEmail?: string;
    saveForFuture?: boolean;
}

/**
 * Base interface for payment request builders.
 * 
 * This is the ABSTRACTION that the UI knows.
 * Infrastructure provides specific IMPLEMENTATIONS.
 * 
 * The UI never imports from infrastructure, only uses this interface.
 */
export interface PaymentRequestBuilder {
    /**
     * Sets the order ID.
     */
    forOrder(orderId: string): this;
    
    /**
     * Sets amount and currency.
     */
    withAmount(amount: number, currency: CurrencyCode): this;
    
    /**
     * Sets payment method specific options.
     * 
     * The UI passes all available options.
     * The builder uses what it needs and validates required ones.
     */
    withOptions(options: PaymentOptions): this;
    
    /**
     * Builds the final request.
     * 
     * @throws Error if required fields are missing for this provider/method
     */
    build(): CreatePaymentRequest;
}

/**
 * Field types supported in the form.
 */
export type FieldType = 'text' | 'email' | 'hidden' | 'url';

/**
 * Payment form field configuration.
 */
export interface FieldConfig {
    /** Field name (key in PaymentOptions) */
    name: keyof PaymentOptions;
    
    /** Label to display in UI */
    label: string;
    
    /** Whether required for this provider/method */
    required: boolean;
    
    /** Input type */
    type: FieldType;
    
    /** Input placeholder */
    placeholder?: string;
    
    /** Default value */
    defaultValue?: string;
    
    /** 
     * If 'hidden', UI must provide it but not display it.
     * E.g., returnUrl can be the current URL
     */
    autoFill?: 'currentUrl' | 'none';
}

/**
 * Field requirements for a specific provider/method.
 * 
 * The UI queries this BEFORE rendering the form
 * to know which fields to show.
 */
export interface FieldRequirements {
    /** Fields this provider/method needs */
    fields: FieldConfig[];
    
    /** Payment method description for UI */
    description?: string;
    
    /** Additional instructions for the user */
    instructions?: string;
}
