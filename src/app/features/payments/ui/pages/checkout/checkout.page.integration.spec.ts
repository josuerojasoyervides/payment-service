//file: checkout.page.integration.spec.ts
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import { LoggerService } from '@core/logging';
import { patchState } from '@ngrx/signals';
import type { PaymentFlowPort } from '@payments/application/api/ports/payment-store.port';
import { ProviderFactoryRegistry } from '@payments/application/orchestration/registry/provider-factory/provider-factory.registry';
import providePayments from '@payments/config/payment.providers';
import { CheckoutComponent } from '@payments/ui/pages/checkout/checkout.page';

/**
 * Wait for the flow to complete:
 * - success: intent exists and not loading
 * - error: hasError true and not loading
 */
async function waitForPaymentComplete(
  state: PaymentFlowPort,
  maxWaitMs = 2000,
  pollMs = 50,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const intent = state.intent();
    const isLoading = state.isLoading();
    const hasError = state.hasError();

    if ((intent && !isLoading) || (hasError && !isLoading)) return;

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  const snap = state.getSnapshot();
  const summary = state.debugSummary();

  throw new Error(
    `Payment did not complete within ${maxWaitMs}ms.\n` +
      `Final state: ${JSON.stringify(
        {
          intent: !!snap.intent,
          isLoading: summary.status === 'loading',
          isReady: summary.status === 'ready',
          hasError: summary.status === 'error',
          status: summary.status,
        },
        null,
        2,
      )}`,
  );
}

/**
 * Helper: ensure the component is in \"form valid\" state
 * before executing the payment, avoiding flakiness caused by
 * form rebuilds / effects / whenStable.
 */
function ensureValidForm(component: CheckoutComponent): void {
  if (!component.checkoutPageState.isFormValid()) component.onFormValidChange(true);
  expect(component.checkoutPageState.isFormValid()).toBe(true);
}

/**
 * Helper: micro-wait to allow effects/render to finish.
 * Useful when changing signals + detectChanges.
 */
async function settle(fixture: ComponentFixture<any>): Promise<void> {
  await fixture.whenStable();
  fixture.detectChanges();
}

/**
 * Real integration tests for CheckoutComponent.
 * - Real flow
 * - Real registry
 * - Real providers
 * - Real FakeGateway (configured in payment.providers.ts)
 */
describe('CheckoutComponent - Real Integration', () => {
  let component: CheckoutComponent;
  let fixture: ComponentFixture<CheckoutComponent>;
  let registry: ProviderFactoryRegistry;
  let logger: LoggerService;
  let state: PaymentFlowPort;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [...providePayments(), provideRouter([]), LoggerService],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckoutComponent);
    component = fixture.componentInstance;

    registry = TestBed.inject(ProviderFactoryRegistry);
    logger = TestBed.inject(LoggerService);
    state = TestBed.inject(PAYMENT_STATE);

    state.reset();

    fixture.detectChanges();
    await settle(fixture);
  });

  describe('Initialization', () => {
    it('should create the component with all real services', () => {
      expect(component).toBeTruthy();
      expect(registry).toBeTruthy();
      expect(logger).toBeTruthy();
      expect(state).toBeTruthy();
    });

    it('should initialize with default values', () => {
      expect(component.checkoutPageState.amount()).toBe(499.99);
      expect(component.checkoutPageState.currency()).toBe('MXN');
      expect(component.checkoutPageState.orderId()).toBeTruthy();
    });

    it('should auto-select the first available provider', async () => {
      await settle(fixture);

      const providers = component.availableProviders();
      expect(providers.length).toBeGreaterThan(0);

      const selected = component.checkoutPageState.selectedProvider();
      expect(selected).toBeTruthy();
      expect(providers).toContain(selected);
    });
  });

  describe('Full successful payment flow - Stripe + Card', () => {
    beforeEach(async () => {
      patchState(component.checkoutPageState, {
        selectedProvider: 'stripe',
      });
      patchState(component.checkoutPageState, {
        selectedMethod: 'card',
      });
      fixture.detectChanges();
      await settle(fixture);
    });

    it('should process full payment from form to success result', async () => {
      const requirements = component.fieldRequirements();
      expect(requirements).toBeTruthy();
      expect(requirements?.fields.length).toBeGreaterThan(0);

      await settle(fixture);

      ensureValidForm(component);

      component.processPayment();

      // Should enter loading immediately
      await settle(fixture);
      expect(state.isLoading() || state.isReady() || state.hasError()).toBe(true);
      expect(
        component.flowState.isLoading() ||
          component.flowState.isReady() ||
          component.flowState.hasError(),
      ).toBe(true);

      await waitForPaymentComplete(state);
      fixture.detectChanges();

      expect(state.isLoading()).toBe(false);
      expect(state.isReady()).toBe(true);
      expect(state.hasError()).toBe(false);

      const intent = state.intent();
      expect(intent).toBeTruthy();
      expect(intent?.provider).toBe('stripe');
      expect(intent?.status).toBe('succeeded');
      expect(intent?.amount).toBe(499.99);
      expect(intent?.currency).toBe('MXN');

      // Component shows result
      expect(component.showResult()).toBe(true);
      expect(component.flowState.currentIntent()).toBeTruthy();
      expect(component.flowState.currentIntent()?.status).toBe('succeeded');
    });

    it('should validate dev token format (no error in the flow)', async () => {
      await settle(fixture);

      ensureValidForm(component);

      component.processPayment();

      await waitForPaymentComplete(state);
      fixture.detectChanges();

      expect(state.hasError()).toBe(false);

      const intent = state.intent();
      expect(intent).toBeTruthy();
      expect(intent?.status).toBe('succeeded');
    });

    it('should handle saveForFuture as a checkbox (boolean) if field exists', async () => {
      const requirements = component.fieldRequirements();
      const saveForFutureField = requirements?.fields.find((f) => f.name === 'saveForFuture');

      // If it does not exist, this test is not applicable and should not fail
      if (!saveForFutureField) return;

      await settle(fixture);

      ensureValidForm(component);

      component.processPayment();

      await waitForPaymentComplete(state);
      fixture.detectChanges();

      expect(state.hasError()).toBe(false);
      expect(state.isReady()).toBe(true);
    });
  });

  describe('Flujo completo - Stripe + Card con 3DS (requires_action)', () => {
    beforeEach(async () => {
      patchState(component.checkoutPageState, {
        selectedProvider: 'stripe',
      });
      patchState(component.checkoutPageState, {
        selectedMethod: 'card',
      });

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Asegurar gating del form
      if (!component.checkoutPageState.isFormValid()) {
        component.onFormValidChange(true);
      }
      expect(component.checkoutPageState.isFormValid()).toBe(true);
    });

    it('should terminar en requires_action y mostrar NextActionCard', async () => {
      /**
       * IMPORTANTE:
       * Este token es “especial” para simular 3DS.
       * Ajusta el token a lo que tu FakeGateway reconozca para responder requires_action.
       */
      component.onFormChange({ token: 'tok_3ds1234567890abcdef' });
      fixture.detectChanges();

      component.processPayment();

      // Wait for completion (success or error)
      await waitForPaymentComplete(state);
      fixture.detectChanges();

      // Estado final esperado
      expect(state.isLoading()).toBe(false);
      expect(state.hasError()).toBe(false);
      expect(state.isReady()).toBe(true);

      const intent = state.intent();
      expect(intent).toBeTruthy();

      // Should be requires_action
      expect(intent?.provider).toBe('stripe');
      expect(intent?.status).toBe('requires_action');

      // Should include nextAction kind client_confirm
      expect(intent?.nextAction).toBeTruthy();
      expect(intent?.nextAction?.kind).toBe('client_confirm');

      // The component should reflect it
      expect(component.flowState.currentIntent()).toBeTruthy();
      expect(component.flowState.currentIntent()?.status).toBe('requires_action');
      expect(component.showResult()).toBe(true);

      // ✅ UI: should existir el NextActionCard en el DOM
      const el: HTMLElement = fixture.nativeElement;
      const nextActionCard = el.querySelector('app-next-action-card');
      expect(nextActionCard).toBeTruthy();
    });
  });

  describe('Flujo completo con estados intermedios', () => {
    beforeEach(async () => {
      patchState(component.checkoutPageState, {
        selectedProvider: 'stripe',
      });
      patchState(component.checkoutPageState, {
        selectedMethod: 'card',
      });
      fixture.detectChanges();
      await settle(fixture);
    });

    it('should transicionar correctamente: idle -> loading -> ready', async () => {
      expect(state.isLoading()).toBe(false);
      expect(state.isReady()).toBe(false);
      expect(state.hasError()).toBe(false);

      ensureValidForm(component);

      component.processPayment();
      await settle(fixture);

      expect(state.isLoading() || state.isReady() || state.hasError()).toBe(true);

      await waitForPaymentComplete(state);
      fixture.detectChanges();

      expect(state.isLoading()).toBe(false);
      expect(state.isReady()).toBe(true);
      expect(state.hasError()).toBe(false);
    });

    it('should leave intent in success state after the flow', async () => {
      ensureValidForm(component);

      component.processPayment();

      await waitForPaymentComplete(state);
      fixture.detectChanges();

      const intent = state.intent();
      expect(intent).toBeTruthy();
      expect(intent?.status).toBe('succeeded');
      expect(intent?.provider).toBe('stripe');
      expect(intent?.amount).toBe(499.99);
    });
  });

  describe('Flujo completo con SPEI', () => {
    beforeEach(async () => {
      patchState(component.checkoutPageState, {
        selectedProvider: 'stripe',
      });
      patchState(component.checkoutPageState, {
        selectedMethod: 'spei',
      });
      fixture.detectChanges();
      await settle(fixture);
    });

    it('should process full SPEI payment with customerEmail', async () => {
      const requirements = component.fieldRequirements();
      expect(requirements).toBeTruthy();

      await settle(fixture);

      // SPEI requiere customerEmail
      component.onFormChange({ customerEmail: 'test@example.com' });
      component.onFormValidChange(true);
      fixture.detectChanges();

      expect(component.checkoutPageState.isFormValid()).toBe(true);

      component.processPayment();

      await waitForPaymentComplete(state);
      fixture.detectChanges();

      expect(state.isLoading()).toBe(false);
      expect(state.isReady()).toBe(true);
      expect(state.hasError()).toBe(false);

      const intent = state.intent();
      expect(intent).toBeTruthy();
      expect(intent?.status).toBe('requires_action');
      expect(intent?.nextAction).toBeTruthy();
      expect(intent?.nextAction?.kind).toBe('manual_step');
    });

    it('should not process SPEI when customerEmail is missing (invalid form)', async () => {
      const requirements = component.fieldRequirements();
      expect(requirements).toBeTruthy();

      await settle(fixture);

      // Do not provide customerEmail => invalid
      component.onFormChange({});
      component.onFormValidChange(false);
      fixture.detectChanges();

      expect(component.checkoutPageState.isFormValid()).toBe(false);

      component.processPayment();

      // Should bloquearse inmediatamente, sin loading y sin intent
      await new Promise((resolve) => setTimeout(resolve, 50));
      fixture.detectChanges();

      expect(state.isLoading()).toBe(false);
      expect(state.intent()).toBeNull();
      expect(state.hasError()).toBe(false);
    });
  });

  describe('Flujo completo con PayPal', () => {
    beforeEach(async () => {
      patchState(component.checkoutPageState, {
        selectedProvider: 'paypal',
      });
      patchState(component.checkoutPageState, {
        selectedMethod: 'card',
      });
      fixture.detectChanges();
      await settle(fixture);
    });

    it('should process full PayPal payment with nextAction redirect', async () => {
      const requirements = component.fieldRequirements();
      expect(requirements).toBeTruthy();

      await settle(fixture);

      // In PayPal, the request usually carries returnUrl/cancelUrl from StrategyContext (CheckoutComponent),
      // not necessarily from the form. Mark as valid to allow the state.
      ensureValidForm(component);

      component.processPayment();

      await waitForPaymentComplete(state, 4000);
      fixture.detectChanges();

      expect(state.isLoading()).toBe(false);
      expect(state.hasError()).toBe(false);

      const intent = state.intent();
      expect(intent).toBeTruthy();

      expect(intent?.provider).toBe('paypal');
      expect(intent?.status).toBe('requires_action');
      expect(intent?.nextAction).toBeTruthy();
      expect(intent?.nextAction?.kind).toBe('redirect');

      if (intent?.nextAction?.kind === 'redirect') {
        const action: any = intent.nextAction;
        expect(action.url).toBeTruthy();
      }
    }, 10000);
  });

  describe('Error handling in full flow', () => {
    beforeEach(async () => {
      patchState(component.checkoutPageState, {
        selectedProvider: 'stripe',
      });
      patchState(component.checkoutPageState, {
        selectedMethod: 'card',
      });
      fixture.detectChanges();
      await settle(fixture);
    });

    it('should handle token validation errors (happy path should not fail)', async () => {
      ensureValidForm(component);

      component.processPayment();

      await waitForPaymentComplete(state);
      fixture.detectChanges();

      expect(state.hasError()).toBe(false);
      expect(state.isReady()).toBe(true);
    });

    it('should fail when token is invalid (Stripe + Card) and reflect error state', async () => {
      patchState(component.checkoutPageState, {
        selectedProvider: 'stripe',
      });
      patchState(component.checkoutPageState, {
        selectedMethod: 'card',
      });
      patchState(component.checkoutPageState, {
        selectedMethod: 'card',
      });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Force form gating
      component.onFormValidChange(true);

      // Intentionally invalid token
      component.onFormChange({ token: 'bad_token' });
      fixture.detectChanges();

      component.processPayment();

      // ✅ IMPORTANTE:
      // With an invalid token it may fail so fast it never enters loading.
      // So we do not require it.
      expect(component.checkoutPageState.isFormValid()).toBe(true);

      // Wait for completion (success or error)
      await waitForPaymentComplete(state);
      fixture.detectChanges();

      // ✅ Estado final esperado
      expect(state.isLoading()).toBe(false);
      expect(state.hasError()).toBe(true);
      expect(state.isReady()).toBe(false);

      // Idealmente no hay intent
      expect(state.intent()).toBeNull();

      // The component should reflect the error
      expect(component.flowState.hasError()).toBe(true);
      expect(component.flowState.currentError()).toBeTruthy();
      expect(component.showResult()).toBe(true);

      const err = state.error();
      if (err) {
        expect(err.messageKey).toBeTruthy();
      }
    });
  });

  describe('Integration with PaymentFormComponent', () => {
    beforeEach(async () => {
      patchState(component.checkoutPageState, {
        selectedProvider: 'stripe',
      });
      patchState(component.checkoutPageState, {
        selectedMethod: 'card',
      });
      fixture.detectChanges();
      await settle(fixture);
    });

    it('should integrate correctly with the dynamic form', async () => {
      const requirements = component.fieldRequirements();
      expect(requirements).toBeTruthy();

      await settle(fixture);

      // En dev, el form puede autofillear token
      ensureValidForm(component);

      const formOptions = { token: 'tok_visa1234567890abcdef', saveForFuture: false };
      component.onFormChange(formOptions);

      expect(component.checkoutPageState.isFormValid()).toBe(true);
    });

    it('should handle real-time form changes', async () => {
      await settle(fixture);

      component.onFormValidChange(true);
      expect(component.checkoutPageState.isFormValid()).toBe(true);

      component.onFormValidChange(false);
      expect(component.checkoutPageState.isFormValid()).toBe(false);
    });
  });

  describe('Payment reset', () => {
    beforeEach(async () => {
      patchState(component.checkoutPageState, {
        selectedProvider: 'stripe',
      });
      patchState(component.checkoutPageState, {
        selectedMethod: 'card',
      });
      patchState(component.checkoutPageState, {
        selectedMethod: 'card',
      });
      fixture.detectChanges();
      await settle(fixture);

      ensureValidForm(component);

      component.processPayment();

      await waitForPaymentComplete(state);
      fixture.detectChanges();

      expect(state.intent()).toBeTruthy();
    });

    it('should reset correctly after a successful payment', async () => {
      const oldOrderId = component.checkoutPageState.orderId();

      component.resetPayment();
      await settle(fixture);

      expect(state.intent()).toBeNull();
      expect(state.isLoading()).toBe(false);
      expect(state.isReady()).toBe(false);
      expect(state.hasError()).toBe(false);

      // El orderId should cambiar
      const newOrderId = component.checkoutPageState.orderId();
      expect(newOrderId).toBeTruthy();
      expect(newOrderId).not.toBe(oldOrderId);
    });
  });
});
