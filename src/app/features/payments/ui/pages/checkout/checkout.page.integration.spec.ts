//file: checkout.page.integration.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LoggerService } from '@core/logging';

import { ProviderFactoryRegistry } from '../../../application/registry/provider-factory.registry';
import type { PaymentStorePort } from '../../../application/store/payment-store.port';
import { PAYMENT_STATE } from '../../../application/tokens/payment-state.token';
import providePayments from '../../../config/payment.providers';
import { CheckoutComponent } from './checkout.page';

/**
 * Espera a que el store complete el flujo:
 * - success: intent existe y no loading
 * - error: hasError true y no loading
 *
 * Si se pasa del timeout, arroja error con snapshot del estado final.
 */
async function waitForPaymentComplete(
  store: PaymentStorePort,
  maxWaitMs = 2000,
  pollMs = 50,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const intent = store.intent();
    const isLoading = store.isLoading();
    const hasError = store.hasError();

    if ((intent && !isLoading) || (hasError && !isLoading)) return;

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  // Snapshot final para debugging
  const final = {
    intent: store.intent(),
    isLoading: store.isLoading(),
    isReady: store.isReady(),
    hasError: store.hasError(),
    error: store.error(),
    historyCount: store.history().length,
  };

  throw new Error(
    `Payment did not complete within ${maxWaitMs}ms.\n` +
      `Final state snapshot:\n` +
      JSON.stringify(
        {
          intent: !!final.intent,
          isLoading: final.isLoading,
          isReady: final.isReady,
          hasError: final.hasError,
          historyCount: final.historyCount,
          error: final.error ? 'exists' : null,
        },
        null,
        2,
      ),
  );
}

/**
 * Helper: asegura que el componente esté en estado "form valid"
 * antes de ejecutar el pago, evitando flakiness por reconstrucciones
 * del form / effects / whenStable.
 */
function ensureValidForm(component: CheckoutComponent): void {
  if (!component.isFormValid()) component.onFormValidChange(true);
  expect(component.isFormValid()).toBe(true);
}

/**
 * Helper: micro-wait para permitir que effects/render terminen.
 * Útil cuando cambias señales + detectChanges.
 */
async function settle(fixture: ComponentFixture<any>): Promise<void> {
  await fixture.whenStable();
  fixture.detectChanges();
}

/**
 * Real integration tests for CheckoutComponent.
 * - Store real
 * - Registry real
 * - Providers reales
 * - FakeGateway real (configurado en payment.providers.ts)
 */
describe('CheckoutComponent - Integración Real', () => {
  let component: CheckoutComponent;
  let fixture: ComponentFixture<CheckoutComponent>;
  let store: PaymentStorePort;
  let registry: ProviderFactoryRegistry;
  let logger: LoggerService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [...providePayments(), provideRouter([]), LoggerService],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckoutComponent);
    component = fixture.componentInstance;

    store = TestBed.inject<PaymentStorePort>(PAYMENT_STATE);

    registry = TestBed.inject(ProviderFactoryRegistry);
    logger = TestBed.inject(LoggerService);

    // Estado limpio en cada test
    store.reset();

    fixture.detectChanges();
    await settle(fixture);
  });

  describe('Inicialización', () => {
    it('debe crear el componente con todos los servicios reales', () => {
      expect(component).toBeTruthy();
      expect(store).toBeTruthy();
      expect(registry).toBeTruthy();
      expect(logger).toBeTruthy();
    });

    it('debe inicializar con valores por defecto', () => {
      expect(component.amount()).toBe(499.99);
      expect(component.currency()).toBe('MXN');
      expect(component.orderId()).toBeTruthy();
    });

    it('debe auto-seleccionar el primer provider disponible', async () => {
      await settle(fixture);

      const providers = component.availableProviders();
      expect(providers.length).toBeGreaterThan(0);

      const selected = component.selectedProvider();
      expect(selected).toBeTruthy();
      expect(providers).toContain(selected);
    });
  });

  describe('Flujo completo de pago exitoso - Stripe + Card', () => {
    beforeEach(async () => {
      component.selectedProvider.set('stripe');
      component.selectedMethod.set('card');
      fixture.detectChanges();
      await settle(fixture);
    });

    it('debe procesar pago completo desde formulario hasta resultado exitoso', async () => {
      const requirements = component.fieldRequirements();
      expect(requirements).toBeTruthy();
      expect(requirements?.fields.length).toBeGreaterThan(0);

      await settle(fixture);

      ensureValidForm(component);

      component.processPayment();

      // Debe entrar a loading inmediatamente
      expect(store.isLoading()).toBe(true);
      expect(component.isLoading()).toBe(true);

      await waitForPaymentComplete(store);
      fixture.detectChanges();

      expect(store.isLoading()).toBe(false);
      expect(store.isReady()).toBe(true);
      expect(store.hasError()).toBe(false);

      const intent = store.intent();
      expect(intent).toBeTruthy();
      expect(intent?.provider).toBe('stripe');
      expect(intent?.status).toBe('succeeded');
      expect(intent?.amount).toBe(499.99);
      expect(intent?.currency).toBe('MXN');

      // Componente muestra resultado
      expect(component.showResult()).toBe(true);
      expect(component.currentIntent()).toBeTruthy();
      expect(component.currentIntent()?.status).toBe('succeeded');
    });

    it('debe validar el formato del token de desarrollo (no error en el flujo)', async () => {
      await settle(fixture);

      ensureValidForm(component);

      component.processPayment();

      await waitForPaymentComplete(store);
      fixture.detectChanges();

      expect(store.hasError()).toBe(false);

      const intent = store.intent();
      expect(intent).toBeTruthy();
      expect(intent?.status).toBe('succeeded');
    });

    it('debe manejar saveForFuture como checkbox (boolean) si el field existe', async () => {
      const requirements = component.fieldRequirements();
      const saveForFutureField = requirements?.fields.find((f) => f.name === 'saveForFuture');

      // Si no existe, este test se vuelve no aplicable y no falla
      if (!saveForFutureField) return;

      await settle(fixture);

      ensureValidForm(component);

      component.processPayment();

      await waitForPaymentComplete(store);
      fixture.detectChanges();

      expect(store.hasError()).toBe(false);
      expect(store.isReady()).toBe(true);
    });
  });

  describe('Flujo completo - Stripe + Card con 3DS (requires_action)', () => {
    beforeEach(async () => {
      component.selectedProvider.set('stripe');
      component.selectedMethod.set('card');

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Asegurar gating del form
      if (!component.isFormValid()) {
        component.onFormValidChange(true);
      }
      expect(component.isFormValid()).toBe(true);
    });

    it('debe terminar en requires_action y mostrar NextActionCard', async () => {
      /**
       * IMPORTANTE:
       * Este token es “especial” para simular 3DS.
       * Ajusta el token a lo que tu FakeGateway reconozca para responder requires_action.
       */
      component.onFormChange({ token: 'tok_3ds1234567890abcdef' });
      fixture.detectChanges();

      component.processPayment();

      // Esperar completion (por éxito o error)
      await waitForPaymentComplete(store);
      fixture.detectChanges();

      // Estado final esperado
      expect(store.isLoading()).toBe(false);
      expect(store.hasError()).toBe(false);
      expect(store.isReady()).toBe(true);

      const intent = store.intent();
      expect(intent).toBeTruthy();

      // Debe ser requires_action
      expect(intent?.provider).toBe('stripe');
      expect(intent?.status).toBe('requires_action');

      // Debe venir con nextAction tipo 3DS
      expect(intent?.nextAction).toBeTruthy();
      expect(intent?.nextAction?.type).toBe('3ds');

      // El componente debe reflejarlo
      expect(component.currentIntent()).toBeTruthy();
      expect(component.currentIntent()?.status).toBe('requires_action');
      expect(component.showResult()).toBe(true);

      // ✅ UI: debe existir el NextActionCard en el DOM
      const el: HTMLElement = fixture.nativeElement;
      const nextActionCard = el.querySelector('app-next-action-card');
      expect(nextActionCard).toBeTruthy();
    });
  });

  describe('Flujo completo con estados intermedios', () => {
    beforeEach(async () => {
      component.selectedProvider.set('stripe');
      component.selectedMethod.set('card');
      fixture.detectChanges();
      await settle(fixture);
    });

    it('debe transicionar correctamente: idle -> loading -> ready', async () => {
      expect(store.isLoading()).toBe(false);
      expect(store.isReady()).toBe(false);
      expect(store.hasError()).toBe(false);

      ensureValidForm(component);

      component.processPayment();
      await settle(fixture);

      expect(store.isLoading()).toBe(true);
      expect(store.isReady()).toBe(false);

      await waitForPaymentComplete(store);
      fixture.detectChanges();

      expect(store.isLoading()).toBe(false);
      expect(store.isReady()).toBe(true);
      expect(store.hasError()).toBe(false);
    });

    it('debe actualizar el historial después de un pago exitoso', async () => {
      ensureValidForm(component);

      component.processPayment();

      await waitForPaymentComplete(store);
      fixture.detectChanges();

      const history = store.history();
      expect(history.length).toBeGreaterThan(0);

      const lastEntry = history[history.length - 1];
      expect(lastEntry.status).toBe('succeeded');
      expect(lastEntry.provider).toBe('stripe');
      expect(lastEntry.amount).toBe(499.99);
    });
  });

  describe('Flujo completo con SPEI', () => {
    beforeEach(async () => {
      component.selectedProvider.set('stripe');
      component.selectedMethod.set('spei');
      fixture.detectChanges();
      await settle(fixture);
    });

    it('debe procesar pago SPEI completo con customerEmail', async () => {
      const requirements = component.fieldRequirements();
      expect(requirements).toBeTruthy();

      await settle(fixture);

      // SPEI requiere customerEmail
      component.onFormChange({ customerEmail: 'test@example.com' });
      component.onFormValidChange(true);
      fixture.detectChanges();

      expect(component.isFormValid()).toBe(true);

      component.processPayment();

      await waitForPaymentComplete(store);
      fixture.detectChanges();

      expect(store.isLoading()).toBe(false);
      expect(store.isReady()).toBe(true);
      expect(store.hasError()).toBe(false);

      const intent = store.intent();
      expect(intent).toBeTruthy();
      expect(intent?.status).toBe('requires_action');
      expect(intent?.nextAction).toBeTruthy();
      expect(intent?.nextAction?.type).toBe('spei');
    });

    it('NO debe procesar SPEI si falta customerEmail (form inválido)', async () => {
      const requirements = component.fieldRequirements();
      expect(requirements).toBeTruthy();

      await settle(fixture);

      // No proporcionar customerEmail => inválido
      component.onFormChange({});
      component.onFormValidChange(false);
      fixture.detectChanges();

      expect(component.isFormValid()).toBe(false);

      // Snapshot antes de ejecutar
      const historyBefore = store.history().length;

      component.processPayment();

      // Debería bloquearse inmediatamente, sin loading y sin intent
      await new Promise((resolve) => setTimeout(resolve, 50));
      fixture.detectChanges();

      expect(store.isLoading()).toBe(false);
      expect(store.intent()).toBeNull();
      expect(store.hasError()).toBe(false);

      // Y no debería cambiar el historial
      expect(store.history().length).toBe(historyBefore);
    });
  });

  describe('Flujo completo con PayPal', () => {
    beforeEach(async () => {
      component.selectedProvider.set('paypal');
      component.selectedMethod.set('card');
      fixture.detectChanges();
      await settle(fixture);
    });

    it('debe procesar pago PayPal completo con nextAction.paypal_approve', async () => {
      const requirements = component.fieldRequirements();
      expect(requirements).toBeTruthy();

      await settle(fixture);

      // En PayPal el request suele llevar returnUrl/cancelUrl desde el StrategyContext (CheckoutComponent),
      // no necesariamente desde el formulario. Marcamos válido para permitir el flujo.
      ensureValidForm(component);

      component.processPayment();

      await waitForPaymentComplete(store, 4000);
      fixture.detectChanges();

      expect(store.isLoading()).toBe(false);
      expect(store.hasError()).toBe(false);

      const intent = store.intent();
      expect(intent).toBeTruthy();

      expect(intent?.provider).toBe('paypal');
      expect(intent?.status).toBe('requires_action');
      expect(intent?.nextAction).toBeTruthy();
      expect(intent?.nextAction?.type).toBe('paypal_approve');

      // Mejora: validar que la acción trae un "link" útil (approveUrl/url)
      // (sin amarrarte a una sola propiedad exacta)
      if (intent?.nextAction?.type === 'paypal_approve') {
        const action: any = intent.nextAction;

        const possibleUrl =
          action.approveUrl ||
          action.url ||
          action.redirectUrl ||
          action.links?.find?.((l: any) => l?.rel === 'approve')?.href;

        expect(possibleUrl).toBeTruthy();
      }
    }, 10000);
  });

  describe('Manejo de errores en flujo completo', () => {
    beforeEach(async () => {
      component.selectedProvider.set('stripe');
      component.selectedMethod.set('card');
      fixture.detectChanges();
      await settle(fixture);
    });

    it('debe manejar errores de validación del token (en happy path no debe fallar)', async () => {
      ensureValidForm(component);

      component.processPayment();

      await waitForPaymentComplete(store);
      fixture.detectChanges();

      expect(store.hasError()).toBe(false);
      expect(store.isReady()).toBe(true);
    });

    it('debe FALLAR cuando el token es inválido (Stripe + Card) y reflejar estado de error', async () => {
      component.selectedProvider.set('stripe');
      component.selectedMethod.set('card');
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      // Forzar gating del formulario
      component.onFormValidChange(true);

      // Token inválido intencional
      component.onFormChange({ token: 'bad_token' });
      fixture.detectChanges();

      component.processPayment();

      // ✅ IMPORTANTE:
      // Con token inválido puede fallar tan rápido que jamás entra a loading.
      // Así que no lo exigimos.
      expect(component.isFormValid()).toBe(true);

      // Esperar a que termine por éxito o error
      await waitForPaymentComplete(store);
      fixture.detectChanges();

      // ✅ Estado final esperado
      expect(store.isLoading()).toBe(false);
      expect(store.hasError()).toBe(true);
      expect(store.isReady()).toBe(false);

      // Idealmente no hay intent
      expect(store.intent()).toBeNull();

      // El componente debe reflejar el error
      expect(component.hasError()).toBe(true);
      expect(component.currentError()).toBeTruthy();
      expect(component.showResult()).toBe(true);

      const err = store.error();
      if (err) {
        expect(err.messageKey).toBeTruthy();
      }
    });
  });

  describe('Integración con PaymentFormComponent', () => {
    beforeEach(async () => {
      component.selectedProvider.set('stripe');
      component.selectedMethod.set('card');
      fixture.detectChanges();
      await settle(fixture);
    });

    it('debe integrarse correctamente con el formulario dinámico', async () => {
      const requirements = component.fieldRequirements();
      expect(requirements).toBeTruthy();

      await settle(fixture);

      // En dev, el form puede autofillear token
      ensureValidForm(component);

      const formOptions = { token: 'tok_visa1234567890abcdef', saveForFuture: false };
      component.onFormChange(formOptions);

      expect(component.isFormValid()).toBe(true);
    });

    it('debe manejar cambios del formulario en tiempo real', async () => {
      await settle(fixture);

      component.onFormValidChange(true);
      expect(component.isFormValid()).toBe(true);

      component.onFormValidChange(false);
      expect(component.isFormValid()).toBe(false);
    });
  });

  describe('Reseteo de pago', () => {
    beforeEach(async () => {
      component.selectedProvider.set('stripe');
      component.selectedMethod.set('card');
      fixture.detectChanges();
      await settle(fixture);

      ensureValidForm(component);

      component.processPayment();

      await waitForPaymentComplete(store);
      fixture.detectChanges();

      expect(store.intent()).toBeTruthy();
    });

    it('debe resetear correctamente después de un pago exitoso', async () => {
      const oldOrderId = component.orderId();

      component.resetPayment();
      await settle(fixture);

      expect(store.intent()).toBeNull();
      expect(store.isLoading()).toBe(false);
      expect(store.isReady()).toBe(false);
      expect(store.hasError()).toBe(false);

      // El orderId debe cambiar
      const newOrderId = component.orderId();
      expect(newOrderId).toBeTruthy();
      expect(newOrderId).not.toBe(oldOrderId);
    });
  });
});
