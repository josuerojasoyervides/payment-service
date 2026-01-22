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
 */

import {
  PaymentMethodType,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import {
  FieldRequirements,
  PaymentRequestBuilder,
} from '@payments/domain/ports/payment/payment-request-builder.port';

import { PaymentGateway } from './payment-gateway.port';
import { PaymentStrategy } from './payment-strategy.port';

/**
 * ! TODO This factory depends on the application layer. It should be moved to the application layer
 * ! or refactor the application ports
 * */
export interface ProviderFactory {
  /** Unique provider identifier */
  readonly providerId: PaymentProviderId;

  /**
   * Returns this provider's gateway.
   * The gateway handles HTTP communication with the provider's API.
   */
  getGateway(): PaymentGateway;

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
}
