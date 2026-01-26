import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { I18nKeys } from '@core/i18n';
import { LoggerService } from '@core/logging';
import { FallbackOrchestratorService } from '@payments/application/services/fallback-orchestrator.service';
import { PaymentFlowFacade } from '@payments/application/state-machine/payment-flow.facade';
import { CancelPaymentUseCase } from '@payments/application/use-cases/cancel-payment.use-case';
import { ConfirmPaymentUseCase } from '@payments/application/use-cases/confirm-payment.use-case';
import { GetPaymentStatusUseCase } from '@payments/application/use-cases/get-payment-status.use-case';
import { StartPaymentUseCase } from '@payments/application/use-cases/start-payment.use-case';
import { FallbackAvailableEvent } from '@payments/domain/models/fallback/fallback-event.types';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import {
  PaymentIntent,
  PaymentMethodType,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import { IdempotencyKeyFactory } from '@payments/shared/idempotency/idempotency-key.factory';

import { ProviderFactoryRegistry } from '../../../application/registry/provider-factory.registry';
import {
  FieldRequirements,
  PaymentOptions,
} from '../../../domain/ports/payment/payment-request-builder.port';
import { CheckoutComponent } from './checkout.page';

describe('CheckoutComponent', () => {
  let component: CheckoutComponent;
  let fixture: ComponentFixture<CheckoutComponent>;
  let mockFlowFacade: any;
  let mockRegistry: any;
  let mockLogger: any;
  let mockFallbackOrchestrator: any;
  let mockFactory: any;
  let mockBuilder: any;

  const mockIntent: PaymentIntent = {
    id: 'pi_test_123',
    provider: 'stripe',
    status: 'succeeded',
    amount: 499.99,
    currency: 'MXN',
    clientSecret: 'secret_test',
  };

  const mockError: PaymentError = {
    code: 'card_declined',
    messageKey: I18nKeys.errors.card_declined,
    raw: { originalError: 'declined' },
  };

  const mockFallbackEvent: FallbackAvailableEvent = {
    eventId: 'fb_test_1',
    failedProvider: 'stripe',
    error: mockError,
    alternativeProviders: ['paypal'],
    originalRequest: {
      orderId: 'order_test',
      amount: 499.99,
      currency: 'MXN',
      method: { type: 'card', token: 'tok_test' },
    },
    timestamp: Date.now(),
  };

  beforeEach(async () => {
    // Mock del builder
    mockBuilder = {
      forOrder: vi.fn().mockReturnThis(),
      withAmount: vi.fn().mockReturnThis(),
      withOptions: vi.fn().mockReturnThis(),
      build: vi.fn().mockReturnValue({
        orderId: 'order_test',
        amount: 499.99,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_test' },
      }),
    };

    // Mock de la factory
    mockFactory = {
      providerId: 'stripe' as const,
      getSupportedMethods: vi.fn(() => ['card', 'spei']),
      getFieldRequirements: vi.fn((method: PaymentMethodType): FieldRequirements => {
        if (method === 'card') {
          return {
            fields: [
              {
                name: 'token',
                labelKey: I18nKeys.ui.card_token,
                required: true,
                type: 'hidden',
              },
            ],
          };
        }
        return {
          fields: [
            {
              name: 'customerEmail',
              labelKey: I18nKeys.ui.email_label,
              required: true,
              type: 'email',
            },
          ],
        };
      }),
      createRequestBuilder: vi.fn(() => mockBuilder),
    };

    // Mock del registry
    mockRegistry = {
      get: vi.fn((providerId: PaymentProviderId) => {
        if (providerId === 'stripe' || providerId === 'paypal') {
          return mockFactory;
        }
        throw new Error(`Provider not found: ${providerId}`);
      }),
      getAvailableProviders: vi.fn(() => ['stripe', 'paypal']),
    };

    // Mock del payment state
    mockFlowFacade = {
      isLoading: signal(false),
      isReady: signal(false),
      hasError: signal(false),
      intent: signal<PaymentIntent | null>(null),
      error: signal<PaymentError | null>(null),
      snapshot: signal({
        value: 'idle',
        context: { providerId: null, intentId: null, intent: null },
        tags: new Set<string>(),
      }),
      lastSentEvent: signal(null),
      redirectUrl: computed(() => null),
      start: vi.fn(() => true),
      confirm: vi.fn(() => true),
      cancel: vi.fn(() => true),
      refresh: vi.fn(() => true),
      reset: vi.fn(),
    };

    mockFallbackOrchestrator = {
      isPending: signal(false),
      pendingEvent: signal<FallbackAvailableEvent | null>(null),
      respondToFallback: vi.fn(),
      reset: vi.fn(),
    };

    // Mock del logger
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      startCorrelation: vi.fn(() => 'correlation_id'),
      endCorrelation: vi.fn(),
      getCorrelationId: vi.fn(() => 'test_corr'),
    };

    await TestBed.configureTestingModule({
      imports: [CheckoutComponent, RouterLink],
      providers: [
        StartPaymentUseCase,
        ConfirmPaymentUseCase,
        CancelPaymentUseCase,
        GetPaymentStatusUseCase,
        IdempotencyKeyFactory,
        { provide: FallbackOrchestratorService, useValue: mockFallbackOrchestrator },
        { provide: PaymentFlowFacade, useValue: mockFlowFacade },
        { provide: ProviderFactoryRegistry, useValue: mockRegistry },
        { provide: LoggerService, useValue: mockLogger },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckoutComponent);
    component = fixture.componentInstance;
  });

  describe('Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default values', () => {
      expect(component.amount()).toBe(499.99);
      expect(component.currency()).toBe('MXN');
      expect(component.selectedProvider()).toBeNull();
      expect(component.selectedMethod()).toBeNull();
      expect(component.isFormValid()).toBe(false);
    });

    it('should auto-select the first available provider', () => {
      fixture.detectChanges();
      expect(component.selectedProvider()).toBe('stripe');
    });

    it('should auto-select the first method when provider is set', () => {
      fixture.detectChanges();
      component.selectedProvider.set('stripe');
      fixture.detectChanges();
      expect(component.selectedMethod()).toBe('card');
    });
  });

  describe('Available providers and methods', () => {
    it('should get available providers from the registry', () => {
      fixture.detectChanges();
      const providers = component.availableProviders();
      expect(providers).toEqual(['stripe', 'paypal']);
      expect(mockRegistry.getAvailableProviders).toHaveBeenCalled();
    });

    it('should get available methods for the selected provider', () => {
      component.selectedProvider.set('stripe');
      fixture.detectChanges();
      const methods = component.availableMethods();
      expect(methods).toEqual(['card', 'spei']);
      expect(mockRegistry.get).toHaveBeenCalledWith('stripe');
      expect(mockFactory.getSupportedMethods).toHaveBeenCalled();
    });

    it('should return an empty array when no provider is selected', () => {
      const methods = component.availableMethods();
      expect(methods).toEqual([]);
    });

    it('should handle errors when fetching methods', () => {
      mockRegistry.get.mockImplementationOnce(() => {
        throw new Error('Provider not found');
      });
      component.selectedProvider.set('stripe' as PaymentProviderId);
      fixture.detectChanges();
      const methods = component.availableMethods();
      expect(methods).toEqual([]);
    });
  });

  describe('Field requirements', () => {
    it('should get field requirements for selected provider and method', () => {
      component.selectedProvider.set('stripe');
      component.selectedMethod.set('card');
      fixture.detectChanges();
      const requirements = component.fieldRequirements();
      expect(requirements).toBeTruthy();
      expect(requirements?.fields.length).toBeGreaterThan(0);
      expect(mockFactory.getFieldRequirements).toHaveBeenCalledWith('card');
    });

    it('should return null when no provider or method is selected', () => {
      const requirements = component.fieldRequirements();
      expect(requirements).toBeNull();
    });

    it('should return null when field requirements throw', () => {
      mockFactory.getFieldRequirements.mockImplementationOnce(() => {
        throw new Error('Error');
      });
      component.selectedProvider.set('stripe');
      component.selectedMethod.set('card');
      fixture.detectChanges();
      const requirements = component.fieldRequirements();
      expect(requirements).toBeNull();
    });
  });

  describe('Provider and method selection', () => {
    it('should select provider correctly', () => {
      component.selectProvider('paypal');
      expect(component.selectedProvider()).toBe('paypal');
      expect(mockLogger.info).toHaveBeenCalledWith('Provider selected', 'CheckoutPage', {
        provider: 'paypal',
      });
    });

    it('should select method correctly', () => {
      component.selectMethod('spei');
      expect(component.selectedMethod()).toBe('spei');
      expect(mockLogger.info).toHaveBeenCalledWith('Method selected', 'CheckoutPage', {
        method: 'spei',
      });
    });
  });

  describe('Form', () => {
    it('should update form options', () => {
      const options: PaymentOptions = { token: 'tok_test' };
      component.onFormChange(options);
      expect(() => component.onFormChange(options)).not.toThrow();
    });

    it('should update form validity state', () => {
      component.onFormValidChange(true);
      expect(component.isFormValid()).toBe(true);
      component.onFormValidChange(false);
      expect(component.isFormValid()).toBe(false);
    });
  });

  describe('Payment process', () => {
    beforeEach(() => {
      component.selectedProvider.set('stripe');
      component.selectedMethod.set('card');
      component.isFormValid.set(true);
    });

    it('should process payment with valid provider and method', () => {
      const orderId = component.orderId();
      component.onFormChange({ token: 'tok_test' });
      component.processPayment();

      expect(mockRegistry.get).toHaveBeenCalledWith('stripe');
      expect(mockFactory.createRequestBuilder).toHaveBeenCalledWith('card');
      expect(mockBuilder.forOrder).toHaveBeenCalledWith(orderId);
      expect(mockBuilder.withAmount).toHaveBeenCalledWith(499.99, 'MXN');
      expect(mockBuilder.build).toHaveBeenCalled();
      expect(mockFlowFacade.start).toHaveBeenCalledWith(
        'stripe',
        expect.any(Object), // request
        expect.objectContaining({
          returnUrl: expect.any(String),
          cancelUrl: expect.any(String),
          isTest: expect.any(Boolean),
          deviceData: expect.any(Object),
        }),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Payment request built',
        'CheckoutPage',
        expect.any(Object),
      );
    });

    it('should not process payment when provider is missing', () => {
      component.selectedProvider.set(null);
      component.processPayment();
      expect(mockFlowFacade.start).not.toHaveBeenCalled();
    });

    it('should not process payment when method is missing', () => {
      component.selectedMethod.set(null);
      component.processPayment();
      expect(mockFlowFacade.start).not.toHaveBeenCalled();
    });

    it('should not process payment when the form is invalid', () => {
      component.isFormValid.set(false);
      component.processPayment();
      expect(mockFlowFacade.start).not.toHaveBeenCalled();
    });

    it('should process payment when isFormValid is true', () => {
      component.isFormValid.set(true);
      component.onFormChange({ token: 'tok_test' });
      component.processPayment();

      // Should process payment (start should be called)
      expect(mockFlowFacade.start).toHaveBeenCalledWith(
        'stripe',
        expect.any(Object), // request
        expect.objectContaining({
          returnUrl: expect.any(String),
          cancelUrl: expect.any(String),
          isTest: expect.any(Boolean),
          deviceData: expect.any(Object),
        }),
      ); // Should not log "Form invalid, payment blocked"
      const blockedCalls = mockLogger.info.mock.calls.filter(
        (call: any[]) => call[0] === 'Form invalid, payment blocked',
      );

      expect(blockedCalls.length).toBe(0);
    });

    it('should use the form token (PaymentFormComponent handles dev autofill)', () => {
      // Token should come from the form, not be injected by CheckoutComponent
      // PaymentFormComponent already handles autofill in development
      component.onFormChange({ token: 'tok_visa1234567890abcdef' });
      component.processPayment();
      expect(mockBuilder.withOptions).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'tok_visa1234567890abcdef' }),
      );
      // Should not log auto-generation in CheckoutComponent
      expect(mockLogger.debug).not.toHaveBeenCalledWith('Auto-generated dev token', 'CheckoutPage');
    });

    it('should handle errors while building the request', () => {
      mockBuilder.build.mockImplementationOnce(() => {
        throw new Error('Build failed');
      });
      component.processPayment();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to build payment request',
        'CheckoutPage',
        expect.any(Error),
      );
    });

    it('should start logging correlation', () => {
      component.processPayment();
      expect(mockLogger.startCorrelation).toHaveBeenCalledWith(
        'payment-flow',
        expect.objectContaining({
          orderId: expect.any(String),
          provider: 'stripe',
          method: 'card',
        }),
      );
      expect(mockLogger.endCorrelation).toHaveBeenCalled();
    });
  });

  describe('Fallback', () => {
    it('should confirm fallback', () => {
      component.confirmFallback('paypal');
      expect(mockFallbackOrchestrator.respondToFallback).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Fallback confirmed', 'CheckoutPage', {
        provider: 'paypal',
      });
    });

    it('should cancel fallback', () => {
      component.cancelFallback();
      expect(mockFallbackOrchestrator.reset).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Fallback cancelled', 'CheckoutPage');
    });

    it('should detect when fallback is pending', () => {
      mockFallbackOrchestrator.isPending.set(true);
      mockFallbackOrchestrator.pendingEvent.set(mockFallbackEvent);
      fixture.detectChanges();
      expect(component.hasPendingFallback()).toBe(true);
      expect(component.pendingFallbackEvent()).toEqual(mockFallbackEvent);
    });
  });

  describe('Payment state', () => {
    it('should expose loading state', () => {
      mockFlowFacade.isLoading.set(true);
      fixture.detectChanges();
      expect(component.isLoading()).toBe(true);
    });

    it('should expose ready state', () => {
      mockFlowFacade.isReady.set(true);
      fixture.detectChanges();
      expect(component.isReady()).toBe(true);
    });

    it('should expose error state', () => {
      mockFlowFacade.hasError.set(true);
      mockFlowFacade.error.set(mockError);
      fixture.detectChanges();
      expect(component.hasError()).toBe(true);
      expect(component.currentError()).toEqual(mockError);
    });

    it('should expose current intent', () => {
      mockFlowFacade.intent.set(mockIntent);
      fixture.detectChanges();
      expect(component.currentIntent()).toEqual(mockIntent);
    });

    it('should show result when ready or when there is an error', () => {
      mockFlowFacade.isReady.set(true);
      fixture.detectChanges();
      expect(component.showResult()).toBe(true);

      mockFlowFacade.isReady.set(false);
      mockFlowFacade.hasError.set(true);
      fixture.detectChanges();
      expect(component.showResult()).toBe(true);
    });
  });

  describe('Reset', () => {
    it('should reset the payment', () => {
      component.resetPayment();
      expect(mockFlowFacade.reset).toHaveBeenCalled();
      expect(component.isFormValid()).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Payment reset', 'CheckoutPage');
      // The orderId should change
      const newOrderId = component.orderId();
      expect(newOrderId).toBeTruthy();
    });
  });

  describe('Debug info', () => {
    it('should expose debug summary for the state', () => {
      const debugSummary = component.debugInfo();
      expect(debugSummary).toBeTruthy();
      expect(debugSummary.state).toBe('idle');
    });
  });
});
