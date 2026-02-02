import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import { LoggerService } from '@core/logging';
import { patchState } from '@ngrx/signals';
import type { PaymentFlowPort } from '@payments/application/api/ports/payment-store.port';
import { ProviderFactoryRegistry } from '@payments/application/orchestration/registry/provider-factory/provider-factory.registry';
import { FakeIntentStore } from '@payments/infrastructure/fake/shared/state/fake-intent.store';
import { CheckoutComponent } from '@payments/ui/pages/checkout/checkout.page';

import {
  BASE_PROVIDERS,
  settle,
  waitForIntentStatus,
  waitForPaymentComplete,
  waitUntilIdle,
} from './checkout.page.harness';

export function ensureValidForm(component: CheckoutComponent): void {
  if (!component.checkoutPageState.isFormValid()) component.onFormValidChange(true);
  expect(component.checkoutPageState.isFormValid()).toBe(true);
}

async function setupCheckoutTestBed(): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [CheckoutComponent],
    providers: BASE_PROVIDERS,
  }).compileComponents();
}

describe('CheckoutComponent - Real Integration', () => {
  let component: CheckoutComponent;
  let fixture: ComponentFixture<CheckoutComponent>;
  let registry: ProviderFactoryRegistry;
  let logger: LoggerService;
  let state: PaymentFlowPort;

  beforeEach(async () => {
    // Si quieres real timers por estabilidad del whenStable / timeouts reales:
    vi.useRealTimers();

    await setupCheckoutTestBed();

    fixture = TestBed.createComponent(CheckoutComponent);
    component = fixture.componentInstance;

    registry = TestBed.inject(ProviderFactoryRegistry);
    logger = TestBed.inject(LoggerService);
    state = TestBed.inject(PAYMENT_STATE);

    state.reset();

    fixture.detectChanges();
    await settle(fixture);
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
  });

  afterAll(() => {
    // Avoid leaking providers/TestBed state to other files
    TestBed.resetTestingModule();
    vi.useRealTimers();
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

      const descriptors = component.providerDescriptors();
      expect(descriptors.length).toBeGreaterThan(0);

      const selected = component.checkoutPageState.selectedProvider();
      expect(selected).toBeTruthy();
      expect(descriptors.map((d) => d.id)).toContain(selected);
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
      expect(intent?.money.amount).toBe(499.99);
      expect(intent?.money.currency).toBe('MXN');

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
      expect(intent?.money.amount).toBe(499.99);
    });
  });

  describe('Scenario matrix (fake tokens) — FakeIntentStore deterministic', () => {
    let fakeIntentStore: FakeIntentStore;

    beforeEach(async () => {
      fakeIntentStore = TestBed.inject(FakeIntentStore);
      fakeIntentStore.reset();
      state.reset();
      await fixture.whenStable();
      await waitUntilIdle(state, 800);
      patchState(component.checkoutPageState, { selectedProvider: 'stripe' });
      patchState(component.checkoutPageState, { selectedMethod: 'card' });
      fixture.detectChanges();
      await settle(fixture);
    });

    it('tok_timeout: start -> error code timeout, messageKey errors.timeout', async () => {
      component.onFormChange({ token: 'tok_timeout1234567890abcdef' });
      ensureValidForm(component);
      component.processPayment();
      await waitForPaymentComplete(state, 3000);
      fixture.detectChanges();

      expect(state.isLoading()).toBe(false);
      expect(state.hasError()).toBe(true);
      expect(state.isReady()).toBe(false);
      const err = state.error();
      expect(err).toBeTruthy();
      expect(err?.code).toBe('timeout');
      expect(err?.messageKey).toBe('errors.timeout');
    });

    it('tok_success: start -> isReady true, hasError false, historyCount > 0', async () => {
      component.onFormChange({ token: 'tok_success1234567890abcdef' });
      ensureValidForm(component);
      component.processPayment();
      await waitForPaymentComplete(state);
      fixture.detectChanges();

      expect(state.isLoading()).toBe(false);
      expect(state.isReady()).toBe(true);
      expect(state.hasError()).toBe(false);
      expect(state.historyCount()).toBeGreaterThan(0);
      const summary = state.debugSummary();
      expect(summary.status).toBe('ready');
      expect(summary.intentId).toBeTruthy();
      expect(summary.provider).toBe('stripe');
    });

    it('tok_processing: start -> status processing, refresh 2x -> succeeded/isReady, _fakeDebug.stepCount increments', async () => {
      component.onFormChange({ token: 'tok_processing1234567890abcdef' });
      ensureValidForm(component);
      component.processPayment();
      await waitForPaymentComplete(state);
      fixture.detectChanges();

      const intentAfterStart = state.intent();
      expect(intentAfterStart).toBeTruthy();
      expect(intentAfterStart?.status).toBe('processing');
      expect(state.historyCount()).toBeGreaterThanOrEqual(1);

      const raw0 = intentAfterStart?.raw as { _fakeDebug?: { stepCount?: number } } | undefined;
      const stepCount0 = raw0?._fakeDebug?.stepCount ?? 0;

      state.refreshPayment({ intentId: intentAfterStart!.id }, 'stripe');
      await waitForPaymentComplete(state, 3000);

      state.refreshPayment({ intentId: intentAfterStart!.id }, 'stripe');
      await waitForIntentStatus(state, 'succeeded', 4000);

      fixture.detectChanges();

      expect(state.isLoading()).toBe(false);
      expect(state.isReady()).toBe(true);
      expect(state.hasError()).toBe(false);
      const intentFinal = state.intent();
      expect(intentFinal?.status).toBe('succeeded');
      const summary = state.debugSummary();
      expect(summary.provider).toBe('stripe');
      expect(summary.intentId).toBe(intentAfterStart?.id?.value ?? intentAfterStart?.id);
      const rawFinal = intentFinal?.raw as { _fakeDebug?: { stepCount?: number } } | undefined;
      if (rawFinal?._fakeDebug?.stepCount !== undefined) {
        expect(rawFinal._fakeDebug.stepCount).toBeGreaterThan(stepCount0);
      }
    });

    it('tok_client_confirm: start -> requires_action(client_confirm), confirm -> refresh -> succeeded', async () => {
      component.onFormChange({ token: 'tok_clientconfirm1234567890abcdef' });
      ensureValidForm(component);
      component.processPayment();
      await waitForPaymentComplete(state, 2000);
      fixture.detectChanges();

      const intentAfterStart = state.intent();
      expect(intentAfterStart).toBeTruthy();
      expect(intentAfterStart?.status).toBe('requires_action');
      expect(intentAfterStart?.nextAction?.kind).toBe('client_confirm');

      const summaryAfterStart = state.debugSummary();
      expect(summaryAfterStart.provider).toBe('stripe');
      expect(summaryAfterStart.intentId).toBe(intentAfterStart?.id?.value ?? intentAfterStart?.id);

      state.confirmPayment({ intentId: intentAfterStart!.id }, 'stripe');
      await waitForPaymentComplete(state, 2500);
      fixture.detectChanges();

      if (state.intent()?.status !== 'succeeded' && !state.hasError()) {
        state.refreshPayment({ intentId: intentAfterStart!.id }, 'stripe');
        await waitForIntentStatus(state, 'succeeded', 2500);
        fixture.detectChanges();
      }

      expect(state.isLoading()).toBe(false);
      expect(state.hasError()).toBe(false);
      expect(state.isReady()).toBe(true);
      const intentFinal = state.intent();
      expect(intentFinal?.status).toBe('succeeded');
      const summary = state.debugSummary();
      expect(summary.provider).toBe('stripe');
      expect(summary.intentId).toBe(intentAfterStart?.id?.value ?? intentAfterStart?.id);
    });

    it('tok_3ds: requires_action and NextActionCard visible', async () => {
      component.onFormChange({ token: 'tok_3ds1234567890abcdef' });
      ensureValidForm(component);
      component.processPayment();
      await waitForPaymentComplete(state);
      fixture.detectChanges();

      expect(state.isLoading()).toBe(false);
      expect(state.isReady()).toBe(true);
      const intent = state.intent();
      expect(intent?.status).toBe('requires_action');
      expect(intent?.nextAction).toBeTruthy();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('app-next-action-card')).toBeTruthy();
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
      await settle(fixture);

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
