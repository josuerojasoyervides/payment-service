import { signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { I18nKeys, I18nService } from '@core/i18n';
import { patchState } from '@ngrx/signals';
import { PaymentFlowFacade } from '@payments/application/orchestration/flow/payment-flow.facade';
import type { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import type { PaymentIntent } from '@payments/domain/models/payment/payment-intent.types';
import { StatusComponent } from '@payments/ui/pages/status/status.page';

describe('StatusComponent', () => {
  let component: StatusComponent;
  let fixture: ComponentFixture<StatusComponent>;
  let mockFlowFacade: any;

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
    // Flow mock
    mockFlowFacade = {
      intent: signal<PaymentIntent | null>(null),
      error: signal<PaymentError | null>(null),
      isLoading: signal(false),
      refresh: vi.fn(() => true),
      confirm: vi.fn(() => true),
      cancel: vi.fn(() => true),
      performNextAction: vi.fn(() => true),
    };

    await TestBed.configureTestingModule({
      imports: [StatusComponent, RouterLink],
      providers: [{ provide: PaymentFlowFacade, useValue: mockFlowFacade }, provideRouter([])],
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
      expect(mockFlowFacade.refresh).not.toHaveBeenCalled();
    });

    it('should not search when intentId is only whitespace', () => {
      patchState(component.statusPageState, { intentId: '   ' });
      component.searchIntent();
      expect(mockFlowFacade.refresh).not.toHaveBeenCalled();
    });

    it('should search intent and reset result', () => {
      patchState(component.statusPageState, { intentId: 'pi_test_123' });
      component.searchIntent();

      expect(component.result()).toBeNull(); // Reset
      expect(mockFlowFacade.refresh).toHaveBeenCalledWith('stripe', 'pi_test_123');
    });

    it('should prefill lastQuery and show result when flow already has an intent', () => {
      // effect() in the constructor listens to intent() changes
      mockFlowFacade.intent.set(mockIntent);
      fixture.detectChanges();

      expect(component.result()).toEqual(mockIntent);
    });

    it('should not show result when intent does not match lastQuery', () => {
      patchState(component.statusPageState, {
        intentId: 'pi_other',
        selectedProvider: 'stripe',
        lastQuery: { provider: 'stripe', id: 'pi_other' },
      });

      mockFlowFacade.intent.set(mockIntent); // pi_test_123
      fixture.detectChanges();

      expect(component.result()).toBeNull();
    });

    it('should use the selected provider', () => {
      patchState(component.statusPageState, { selectedProvider: 'paypal' });
      patchState(component.statusPageState, { intentId: 'ORDER_FAKE_XYZ' });
      component.searchIntent();

      expect(mockFlowFacade.refresh).toHaveBeenCalledWith('paypal', 'ORDER_FAKE_XYZ');
    });

    it('should trim whitespace from intentId', () => {
      patchState(component.statusPageState, { intentId: '  pi_test_123  ' });
      component.searchIntent();

      expect(mockFlowFacade.refresh).toHaveBeenCalledWith('stripe', 'pi_test_123');
    });
  });

  describe('Payment actions', () => {
    it('should confirm payment', () => {
      component.confirmPayment('pi_test_123');
      expect(mockFlowFacade.confirm).toHaveBeenCalled();
    });

    it('should cancel payment', () => {
      component.cancelPayment('pi_test_123');
      expect(mockFlowFacade.cancel).toHaveBeenCalled();
    });

    it('should refresh payment', () => {
      component.refreshPayment('pi_test_123');
      expect(mockFlowFacade.refresh).toHaveBeenCalledWith('stripe', 'pi_test_123');
    });

    it('should use the selected provider for actions', () => {
      patchState(component.statusPageState, { selectedProvider: 'paypal' });
      component.confirmPayment('ORDER_FAKE_XYZ');
      expect(mockFlowFacade.confirm).toHaveBeenCalled();
    });

    it('should call performNextAction when next-action is requested', () => {
      const action = { kind: 'client_confirm' as const, token: 'tok_runtime' };
      component.onNextActionRequested(action);
      expect(mockFlowFacade.performNextAction).toHaveBeenCalledWith(action);
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
      mockFlowFacade.error.set(mockError);
      fixture.detectChanges();
      expect(component.flowState.error()).toEqual(mockError);
    });
  });

  describe('Component state', () => {
    it('should expose isLoading from payment state', () => {
      mockFlowFacade.isLoading.set(true);
      fixture.detectChanges();
      expect(component.flowState.isLoading()).toBe(true);
    });

    it('should expose error from payment state', () => {
      mockFlowFacade.error.set(mockError);
      fixture.detectChanges();
      expect(component.flowState.error()).toEqual(mockError);
    });
  });
});
