/**
 * Port for payment provider factories.
 *
 * Each provider (Stripe, PayPal, etc.) implements this interface
 * to expose its gateway, strategies and builders.
 *
 * Pattern: Abstract Factory
 * - Creates families of related objects (gateway + strategies + builders)
 * - Without specifying their concrete classes
 *
 * The UI uses this interface to:
 * 1. Know which methods the provider supports (getSupportedMethods)
 * 2. Know which fields each method needs (getFieldRequirements)
 * 3. Get the correct builder (createRequestBuilder)
 *
 * Optional capability: getClientConfirmHandler — providers that support
 * client-side confirmation (e.g. Stripe 3DS) expose a ClientConfirmPort;
 * others return null.
 */

import type { ClientConfirmPort } from '@payments/application/api/ports/client-confirm.port';
import type { FinalizePort } from '@payments/application/api/ports/finalize.port';
import type { PaymentGatewayPort } from '@payments/application/api/ports/payment-gateway.port';
import type { PaymentStrategy } from '@payments/application/api/ports/payment-strategy.port';
import type {
  PaymentMethodType,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import type {
  FieldRequirements,
  PaymentRequestBuilder,
} from '@payments/domain/ports/payment/payment-request-builder.port';

export interface ProviderFactory {
  /** Unique provider identifier */
  readonly providerId: PaymentProviderId;

  /**
   * Returns this provider's gateway.
   * The gateway handles HTTP communication with the provider's API.
   */
  getGateway(): PaymentGatewayPort;

  /**
   * Creates a strategy for the payment method type.
   *
   * @param type Payment method type (card, spei, etc.)
   * @throws Error if the method is not supported by this provider
   */
  createStrategy(type: PaymentMethodType): PaymentStrategy;

  /**
   * Checks if this provider supports a payment method.
   *
   * Useful for showing available options in the UI
   * or for validation before attempting to create a strategy.
   */
  supportsMethod(type: PaymentMethodType): boolean;

  /**
   * Returns the list of supported payment methods.
   */
  getSupportedMethods(): PaymentMethodType[];

  /**
   * Creates a builder specific to this provider and method.
   *
   * The returned builder knows exactly which fields it needs
   * and validates they are present when calling build().
   *
   * @param type Payment method type
   * @returns Builder specific to this provider+method combination
   * @throws Error if the method is not supported
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
   * Returns field requirements for a payment method.
   *
   * The UI uses this to:
   * - Render the form with correct fields
   * - Show which fields are required vs optional
   * - Auto-fill fields like returnUrl with current URL
   *
   * @param type Payment method type
   * @returns Required fields configuration
   *
   * @example
   * const requirements = factory.getFieldRequirements('card');
   * // requirements.fields = [
   * //   { name: 'token', required: true, type: 'hidden', ... },
   * //   { name: 'saveForFuture', required: false, type: 'checkbox', ... }
   * // ]
   */
  getFieldRequirements(type: PaymentMethodType): FieldRequirements;

  /**
   * Optional: returns a handler for client-side confirmation (e.g. Stripe 3DS).
   * Providers that do not support client confirm return null.
   * Application routing uses this capability; no provider-name branching.
   */
  getClientConfirmHandler?(): ClientConfirmPort | null;

  /**
   * Optional: returns a handler for finalization (e.g. PayPal capture/complete order).
   * Not all providers support a finalize step; those providers return null.
   * Application routing uses this capability; no provider-name branching.
   */
  getFinalizeHandler?(): FinalizePort | null;
}
