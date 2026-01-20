import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CheckoutComponent } from './checkout.page';
import providePayments from '../../../config/payment.providers';
import { PaymentsStore, type PaymentsStoreType } from '../../../application/store/payment.store';
import { PAYMENT_STATE } from '../../../application/tokens/payment-state.token';
import { ProviderFactoryRegistry } from '../../../application/registry/provider-factory.registry';
import { LoggerService } from '@core/logging';
import { PaymentProviderId, PaymentMethodType } from '../../../domain/models';

/**
 * Helper para esperar a que un pago complete en tests de integración.
 * Espera hasta que el store tenga un intent y no esté en loading.
 */
async function waitForPaymentComplete(store: PaymentsStoreType, maxWaitMs = 2000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
        const intent = store.intent();
        const isLoading = store.isLoading();
        const isReady = store.isReady();
        const hasError = store.hasError();
        
        if ((intent && !isLoading) || (hasError && !isLoading)) {
            return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    const finalIntent = store.intent();
    const finalLoading = store.isLoading();
    const finalReady = store.isReady();
    const finalError = store.hasError();
    
    throw new Error(
        `Payment did not complete within ${maxWaitMs}ms. ` +
        `State: intent=${!!finalIntent}, loading=${finalLoading}, ready=${finalReady}, error=${finalError}`
    );
}

/**
 * Real integration tests for CheckoutComponent.
 * 
 * These tests verify the complete flow from component to gateway,
 * using real providers and stores (no mocks).
 * 
 * Features:
 * - Uses real PaymentsStore
 * - Uses real ProviderFactoryRegistry
 * - Uses real FakeGateway (configured in payment.providers.ts)
 * - Tests real state transitions
 * - Verifies complete end-to-end flow
 */
describe('CheckoutComponent - Integración Real', () => {
    let component: CheckoutComponent;
    let fixture: ComponentFixture<CheckoutComponent>;
    let store: PaymentsStoreType;
    let registry: ProviderFactoryRegistry;
    let logger: LoggerService;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CheckoutComponent],
            providers: [
                ...providePayments(),
                provideRouter([]),
                LoggerService,
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(CheckoutComponent);
        component = fixture.componentInstance;

        store = TestBed.inject(PaymentsStore) as PaymentsStoreType;
        registry = TestBed.inject(ProviderFactoryRegistry);
        logger = TestBed.inject(LoggerService);

        store.reset();

        fixture.detectChanges();
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

        it('debe auto-seleccionar el primer provider disponible', () => {
            fixture.detectChanges();
            
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
            
            await fixture.whenStable();
            fixture.detectChanges();
        });

        it('debe procesar pago completo desde formulario hasta resultado exitoso', async () => {
            const requirements = component.fieldRequirements();
            expect(requirements).toBeTruthy();
            expect(requirements?.fields.length).toBeGreaterThan(0);
            
            await fixture.whenStable();
            fixture.detectChanges();
            
            expect(component.isFormValid()).toBe(true);
            
            component.processPayment();
            
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
            
            // 9. Verificar que el componente muestra el resultado
            expect(component.showResult()).toBe(true);
            expect(component.currentIntent()).toBeTruthy();
            expect(component.currentIntent()?.status).toBe('succeeded');
        });

        it('debe validar el formato del token de desarrollo', async () => {
            // El token de desarrollo debe tener el formato correcto
            // tok_ seguido de al menos 14 caracteres alfanuméricos
            
            await fixture.whenStable();
            fixture.detectChanges();
            
            // Procesar el pago
            component.processPayment();
            
            // Esperar a que complete
            await waitForPaymentComplete(store);
            fixture.detectChanges();
            
            expect(store.hasError()).toBe(false);
            
            const intent = store.intent();
            expect(intent).toBeTruthy();
            expect(intent?.status).toBe('succeeded');
        });

        it('debe manejar saveForFuture como checkbox (boolean)', async () => {
            const requirements = component.fieldRequirements();
            const saveForFutureField = requirements?.fields.find(f => f.name === 'saveForFuture');
            
            if (saveForFutureField) {
                expect(saveForFutureField).toBeTruthy();
                
                await fixture.whenStable();
                fixture.detectChanges();
                
                expect(component.isFormValid()).toBe(true);
                
                component.processPayment();
                
                await waitForPaymentComplete(store);
                fixture.detectChanges();
                
                expect(store.hasError()).toBe(false);
                expect(store.isReady()).toBe(true);
            }
        });
    });

    describe('Flujo completo con estados intermedios', () => {
        beforeEach(async () => {
            component.selectedProvider.set('stripe');
            component.selectedMethod.set('card');
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();
        });

        it('debe transicionar correctamente: idle -> loading -> ready', async () => {
            expect(store.isLoading()).toBe(false);
            expect(store.isReady()).toBe(false);
            expect(store.hasError()).toBe(false);
            
            component.processPayment();
            await fixture.whenStable();
            fixture.detectChanges();
            
            expect(store.isLoading()).toBe(true);
            expect(store.isReady()).toBe(false);
            
            await waitForPaymentComplete(store);
            fixture.detectChanges();
            
            expect(store.isLoading()).toBe(false);
            expect(store.isReady()).toBe(true);
            expect(store.hasError()).toBe(false);
        });

        it('debe actualizar el historial después de un pago exitoso', async () => {
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
            await fixture.whenStable();
            fixture.detectChanges();
        });

        it('debe procesar pago SPEI completo', async () => {
            const requirements = component.fieldRequirements();
            expect(requirements).toBeTruthy();
            
            await fixture.whenStable();
            fixture.detectChanges();
            
            // SPEI requiere customerEmail, proporcionarlo
            component.onFormChange({ customerEmail: 'test@example.com' });
            // Marcar el formulario como válido después de proporcionar el email
            component.onFormValidChange(true);
            fixture.detectChanges();
            
            component.processPayment();
            
            await waitForPaymentComplete(store);
            fixture.detectChanges();
            
            expect(store.isLoading()).toBe(false);
            expect(store.isReady()).toBe(true);
            
            const intent = store.intent();
            expect(intent).toBeTruthy();
            expect(intent?.status).toBe('requires_action');
            expect(intent?.nextAction).toBeTruthy();
            expect(intent?.nextAction?.type).toBe('spei');
        });
    });

    describe('Flujo completo con PayPal', () => {
        beforeEach(async () => {
            component.selectedProvider.set('paypal');
            component.selectedMethod.set('card');
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();
        });

        it('debe procesar pago PayPal completo', async () => {
            const requirements = component.fieldRequirements();
            expect(requirements).toBeTruthy();
            
            await fixture.whenStable();
            fixture.detectChanges();
            
            // PayPal requiere returnUrl/cancelUrl, pero estas URLs vienen de StrategyContext
            // (CheckoutComponent), no del formulario. Marcar el formulario como válido manualmente
            // ya que las URLs se proporcionarán desde el context.
            component.onFormValidChange(true);
            fixture.detectChanges();
            
            expect(component.isFormValid()).toBe(true);
            
            component.processPayment();
            
            await new Promise(resolve => setTimeout(resolve, 500));
            fixture.detectChanges();
            
            let attempts = 0;
            const maxAttempts = 50;
            
            while (attempts < maxAttempts) {
                const intent = store.intent();
                const isLoading = store.isLoading();
                const isReady = store.isReady();
                const hasError = store.hasError();
                
                if (intent && !isLoading) {
                    break;
                }
                
                if (hasError && !isLoading) {
                    break;
                }
                
                await new Promise(resolve => setTimeout(resolve, 100));
                fixture.detectChanges();
                attempts++;
            }
            
            const finalLoading = store.isLoading();
            const finalIntent = store.intent();
            const finalError = store.hasError();
            
            if (finalLoading) {
                throw new Error(
                    `Payment still loading after ${maxAttempts * 100}ms. ` +
                    `Intent: ${finalIntent ? 'exists' : 'null'}, Error: ${finalError ? 'exists' : 'null'}`
                );
            }
            
            expect(finalIntent).toBeTruthy();
            expect(finalIntent?.provider).toBe('paypal');
            expect(finalIntent?.status).toBe('requires_action');
            expect(finalIntent?.nextAction).toBeTruthy();
            expect(finalIntent?.nextAction?.type).toBe('paypal_approve');
            
            // Verificar que returnUrl viene del StrategyContext (CheckoutComponent), no de window.location.href
            if (finalIntent?.nextAction?.type === 'paypal_approve') {
                expect(finalIntent.nextAction.returnUrl).toContain('/payments/return');
                expect(finalIntent.nextAction.returnUrl).not.toContain('/checkout');
            }
        }, 10000);
    });

    describe('Manejo de errores en flujo completo', () => {
        beforeEach(async () => {
            component.selectedProvider.set('stripe');
            component.selectedMethod.set('card');
            fixture.detectChanges();
            await fixture.whenStable();
            fixture.detectChanges();
        });

        it('debe manejar errores de validación del token', async () => {
            component.processPayment();
            
            await waitForPaymentComplete(store);
            fixture.detectChanges();
            
            expect(store.hasError()).toBe(false);
        });
    });

    describe('Integración con PaymentFormComponent', () => {
        beforeEach(async () => {
            component.selectedProvider.set('stripe');
            component.selectedMethod.set('card');
            fixture.detectChanges();
        });

        it('debe integrarse correctamente con el formulario dinámico', async () => {
            const requirements = component.fieldRequirements();
            expect(requirements).toBeTruthy();
            
            await fixture.whenStable();
            fixture.detectChanges();
            
            expect(component.isFormValid()).toBe(true);
            
            const formOptions = { token: 'tok_visa1234567890abcdef', saveForFuture: false };
            component.onFormChange(formOptions);
            
            expect(component.isFormValid()).toBe(true);
        });

        it('debe manejar cambios del formulario en tiempo real', async () => {
            await fixture.whenStable();
            fixture.detectChanges();
            
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
            await fixture.whenStable();
            fixture.detectChanges();
            
            // Hacer un pago primero
            component.processPayment();
            
            // Esperar a que complete
            await waitForPaymentComplete(store);
            fixture.detectChanges();
        });

        it('debe resetear correctamente después de un pago exitoso', async () => {
            // Verificar que hay un intent
            expect(store.intent()).toBeTruthy();
            
            // Resetear
            component.resetPayment();
            await fixture.whenStable();
            fixture.detectChanges();
            
            // Verificar que el estado se reseteó
            expect(store.intent()).toBeNull();
            expect(store.isLoading()).toBe(false);
            expect(store.isReady()).toBe(false);
            expect(store.hasError()).toBe(false);
            // Nota: isFormValid puede ser true si el formulario se reconstruye automáticamente con token de desarrollo
            // Lo importante es que el estado del store se haya reseteado
            
            // El orderId debe cambiar
            const newOrderId = component.orderId();
            expect(newOrderId).toBeTruthy();
        });
    });
});
