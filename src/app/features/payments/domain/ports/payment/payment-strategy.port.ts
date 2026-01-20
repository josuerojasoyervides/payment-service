import { Observable } from "rxjs";
import { PaymentIntent, PaymentMethodType } from "../../models/payment/payment-intent.types";
import { CreatePaymentRequest } from "../../models/payment/payment-request.types";

/**
 * Strategy preparation result.
 * Contains information needed for the client to proceed.
 */
export interface StrategyPrepareResult {
    /** Request modified/enriched by the strategy */
    preparedRequest: CreatePaymentRequest;
    /** Additional metadata the strategy wants to attach */
    metadata: Record<string, unknown>;
}

/**
 * Strategy execution context.
 * Allows passing additional information to the flow.
 */
export interface StrategyContext {
    /** Return URL after 3DS or redirect */
    returnUrl?: string;
    /** Cancel URL (for PayPal) */
    cancelUrl?: string;
    /** Indicates if it's a test environment */
    isTest?: boolean;
    /** Device information for fraud prevention */
    deviceData?: {
        ipAddress?: string;
        userAgent?: string;
        screenWidth?: number;
        screenHeight?: number;
    };
}

/**
 * Port for payment strategies.
 *
 * Each strategy implements specific logic for a payment method.
 * This includes validations, transformations and special flow handling.
 */
export interface PaymentStrategy {
    readonly type: PaymentMethodType;

    /**
     * Validates that the request is valid for this payment method.
     * @throws Error if validation fails
     */
    validate(req: CreatePaymentRequest): void;

    /**
     * Prepares the request before sending it to the gateway.
     * Can enrich the request with method-specific data.
     */
    prepare(req: CreatePaymentRequest, context?: StrategyContext): StrategyPrepareResult;

    /**
     * Starts the complete payment flow.
     * Combines validate → prepare → gateway.createIntent
     */
    start(req: CreatePaymentRequest, context?: StrategyContext): Observable<PaymentIntent>;

    /**
     * Indicates if this method requires additional user action.
     * For example: 3DS for cards, redirect for PayPal, CLABE for SPEI.
     */
    requiresUserAction(intent: PaymentIntent): boolean;

    /**
     * Gets specific instructions for the user based on the intent.
     */
    getUserInstructions(intent: PaymentIntent): string | null;
}
