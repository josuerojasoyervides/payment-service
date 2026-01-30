import type { signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { createMockPaymentState } from '@app/features/payments/application/api/testing/provide-mock-payment-state.harness';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import { I18nKeys, I18nService } from '@core/i18n';
import { patchState } from '@ngrx/signals';
import type { PaymentFlowPort } from '@payments/application/api/ports/payment-store.port';
import type { PaymentError } from '@payments/domain/subdomains/payment/contracts/payment-error.types';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/contracts/payment-intent.types';
import { StatusComponent } from '@payments/ui/pages/status/status.page';

describe('StatusComponent', () => {
  let component: StatusComponent;
  let fixture: ComponentFixture<StatusComponent>;
  let mockState: PaymentFlowPort & {
    confirmPayment: ReturnType<typeof vi.fn>;
    cancelPayment: ReturnType<typeof vi.fn>;
    refreshPayment: ReturnType<typeof vi.fn>;
    intent: ReturnType<typeof signal<PaymentIntent | null>>;
    error: ReturnType<typeof signal<PaymentError | null>>;
    isLoading: ReturnType<typeof signal<boolean>>;
  };

  const mockIntent: PaymentIntent = {
    id: 'pi_test_123',
    provider: 'stripe',
    status: 'succeeded',
    amount: 499.99,
    currency: 'MXN',
    clientSecret: 'secret_test',
  };

  const mockError: PaymentError = {
    code: 'provider_error',
    messageKey: I18nKeys.errors.provider_error,
    raw: { originalError: 'not_found' },
  };

  beforeEach(async () => {
    const baseMock = createMockPaymentState();
    mockState = {
      ...baseMock,
      intent: baseMock.intent as ReturnType<typeof signal<PaymentIntent | null>>,
      error: baseMock.error as ReturnType<typeof signal<PaymentError | null>>,
      isLoading: baseMock.isLoading as ReturnType<typeof signal<boolean>>,
      confirmPayment: vi.fn(),
      cancelPayment: vi.fn(),
      refreshPayment: vi.fn(),
    } as PaymentFlowPort & {
      confirmPayment: ReturnType<typeof vi.fn>;
      cancelPayment: ReturnType<typeof vi.fn>;
      refreshPayment: ReturnType<typeof vi.fn>;
      intent: ReturnType<typeof signal<PaymentIntent | null>>;
      error: ReturnType<typeof signal<PaymentError | null>>;
      isLoading: ReturnType<typeof signal<boolean>>;
    };

    await TestBed.configureTestingModule({
      imports: [StatusComponent, RouterLink],
      providers: [{ provide: PAYMENT_STATE, useValue: mockState }, provideRouter([])],
    }).compileComponents();

    const i18n = TestBed.inject(I18nService);
    vi.spyOn(i18n, 't').mockImplementation((key: string) => key);

    fixture = TestBed.createComponent(StatusComponent);
    component = fixture.componentInstance;
  });

  describe('Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default values', () => {
      expect(component.intentIdModel).toBe('');
      expect(component.statusPageState.selectedProvider()).toBe('stripe');
      expect(component.result()).toBeNull();
    });

    it('should have predefined examples', () => {
      expect(component.examples()).toHaveLength(2);
      expect(component.examples()[0].provider).toBe('stripe');
      expect(component.examples()[1].provider).toBe('paypal');
    });
  });

  describe('Intent search', () => {
    it('should not search when intentId is empty', () => {
      patchState(component.statusPageState, { intentId: '' });
      component.searchIntent();
      expect(mockState.refreshPayment).not.toHaveBeenCalled();
    });

    it('should not search when intentId is only whitespace', () => {
      patchState(component.statusPageState, { intentId: '   ' });
      component.searchIntent();
      expect(mockState.refreshPayment).not.toHaveBeenCalled();
    });

    it('should search intent and reset result', () => {
      patchState(component.statusPageState, { intentId: 'pi_test_123' });
      component.searchIntent();

      expect(component.result()).toBeNull();
      expect(mockState.refreshPayment).toHaveBeenCalledWith({ intentId: 'pi_test_123' }, 'stripe');
    });

    it('should prefill lastQuery and show result when flow already has an intent', () => {
      (mockState.intent as ReturnType<typeof signal<PaymentIntent | null>>).set(mockIntent);
      fixture.detectChanges();

      expect(component.result()).toEqual(mockIntent);
    });

    it('should not show result when intent does not match lastQuery', () => {
      patchState(component.statusPageState, {
        intentId: 'pi_other',
        selectedProvider: 'stripe',
        lastQuery: { provider: 'stripe', id: 'pi_other' },
      });

      (mockState.intent as ReturnType<typeof signal<PaymentIntent | null>>).set(mockIntent);
      fixture.detectChanges();

      expect(component.result()).toBeNull();
    });

    it('should use the selected provider', () => {
      patchState(component.statusPageState, { selectedProvider: 'paypal' });
      patchState(component.statusPageState, { intentId: 'ORDER_FAKE_XYZ' });
      component.searchIntent();

      expect(mockState.refreshPayment).toHaveBeenCalledWith(
        { intentId: 'ORDER_FAKE_XYZ' },
        'paypal',
      );
    });

    it('should trim whitespace from intentId', () => {
      patchState(component.statusPageState, { intentId: '  pi_test_123  ' });
      component.searchIntent();

      expect(mockState.refreshPayment).toHaveBeenCalledWith({ intentId: 'pi_test_123' }, 'stripe');
    });
  });

  describe('Payment actions', () => {
    it('should confirm payment', () => {
      component.confirmPayment('pi_test_123');
      expect(mockState.confirmPayment).toHaveBeenCalledWith({ intentId: 'pi_test_123' }, 'stripe');
    });

    it('should cancel payment', () => {
      component.cancelPayment('pi_test_123');
      expect(mockState.cancelPayment).toHaveBeenCalledWith({ intentId: 'pi_test_123' }, 'stripe');
    });

    it('should refresh payment', () => {
      component.refreshPayment('pi_test_123');
      expect(mockState.refreshPayment).toHaveBeenCalledWith({ intentId: 'pi_test_123' }, 'stripe');
    });

    it('should use the selected provider for actions', () => {
      patchState(component.statusPageState, { selectedProvider: 'paypal' });
      component.confirmPayment('ORDER_FAKE_XYZ');
      expect(mockState.confirmPayment).toHaveBeenCalledWith(
        { intentId: 'ORDER_FAKE_XYZ' },
        'paypal',
      );
    });

    it('should call confirmPayment when next-action client_confirm is requested', () => {
      patchState(component.statusPageState, {
        lastQuery: { provider: 'stripe', id: 'pi_test_123' },
      });
      const action = { kind: 'client_confirm' as const, token: 'tok_runtime' };
      component.onNextActionRequested(action);
      expect(mockState.confirmPayment).toHaveBeenCalledWith({ intentId: 'pi_test_123' }, 'stripe');
    });
  });

  describe('Examples', () => {
    it('should use an example and update intentId and provider', () => {
      const example = component.examples()[0];
      component.useExample(example);
      expect(component.statusPageState.intentId()).toBe(example.id);
      expect(component.statusPageState.selectedProvider()).toBe(example.provider);
    });

    it('should work with PayPal examples', () => {
      const example = component.examples()[1];
      component.useExample(example);
      expect(component.statusPageState.intentId()).toBe(example.id);
      expect(component.statusPageState.selectedProvider()).toBe('paypal');
    });
  });

  describe('Error handling', () => {
    it('should get the error message correctly', () => {
      const errorMsg = component.getErrorMessage(mockError);
      expect(errorMsg).toBe(I18nKeys.errors.provider_error);
    });

    it('should return a generic message for unknown errors', () => {
      const errorMsg = component.getErrorMessage('string error');
      expect(errorMsg).toBe(I18nKeys.errors.unknown_error);
    });

    it('should return a generic message for objects without a message', () => {
      const errorMsg = component.getErrorMessage({ code: 'unknown' });
      expect(errorMsg).toBe(I18nKeys.errors.unknown_error);
    });

    it('should expose error from payment state', () => {
      (mockState.error as ReturnType<typeof signal<PaymentError | null>>).set(mockError);
      fixture.detectChanges();
      expect(component.flowState.error()).toEqual(mockError);
    });
  });

  describe('Component state', () => {
    it('should expose isLoading from payment state', () => {
      const loadingMock = createMockPaymentState({ isLoading: true });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [StatusComponent, RouterLink],
        providers: [{ provide: PAYMENT_STATE, useValue: loadingMock }, provideRouter([])],
      }).compileComponents();
      const i18n = TestBed.inject(I18nService);
      vi.spyOn(i18n, 't').mockImplementation((key: string) => key);
      fixture = TestBed.createComponent(StatusComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.flowState.isLoading()).toBe(true);
    });

    it('should expose error from payment state', () => {
      (mockState.error as ReturnType<typeof signal<PaymentError | null>>).set(mockError);
      fixture.detectChanges();
      expect(component.flowState.error()).toEqual(mockError);
    });
  });
});
