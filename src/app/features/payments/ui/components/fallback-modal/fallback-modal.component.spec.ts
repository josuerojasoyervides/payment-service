import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { FallbackModalComponent } from './fallback-modal.component';
import { PaymentProviderId, FallbackAvailableEvent, PaymentError } from '../../../domain/models';
import { I18nService } from '@core/i18n';

describe('FallbackModalComponent', () => {
    let component: FallbackModalComponent;
    let fixture: ComponentFixture<FallbackModalComponent>;
    let mockI18n: any;

    const mockError: PaymentError = {
        code: 'provider_error',
        message: 'Provider unavailable',
        raw: { error: 'test' },
    };

    const mockEvent1: FallbackAvailableEvent = {
        eventId: 'event_1',
        failedProvider: 'stripe',
        error: mockError,
        alternativeProviders: ['paypal'],
        originalRequest: {
            orderId: 'order_1',
            amount: 100,
            currency: 'MXN',
            method: { type: 'card', token: 'tok_test' },
        },
        timestamp: Date.now(),
    };

    const mockEvent2: FallbackAvailableEvent = {
        eventId: 'event_2',
        failedProvider: 'paypal',
        error: mockError,
        alternativeProviders: ['stripe'],
        originalRequest: {
            orderId: 'order_2',
            amount: 200,
            currency: 'MXN',
            method: { type: 'card', token: 'tok_test' },
        },
        timestamp: Date.now(),
    };

    beforeEach(async () => {
        mockI18n = {
            t: vi.fn((key: string) => key),
            setLanguage: vi.fn(),
            getLanguage: vi.fn(() => 'es'),
            has: vi.fn(() => true),
            currentLang: { asReadonly: vi.fn() } as any,
        };

        await TestBed.configureTestingModule({
            imports: [FallbackModalComponent],
            providers: [
                { provide: I18nService, useValue: mockI18n },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(FallbackModalComponent);
        component = fixture.componentInstance;
    });

    describe('Inicialización', () => {
        it('debe crear el componente', () => {
            expect(component).toBeTruthy();
        });

        it('debe inicializar con selectedProvider en null', () => {
            expect(component.selectedProvider()).toBeNull();
        });
    });

    describe('Selección de provider', () => {
        it('debe seleccionar un provider', () => {
            component.selectProvider('paypal');
            expect(component.selectedProvider()).toBe('paypal');
        });

        it('debe cambiar la selección', () => {
            component.selectProvider('paypal');
            component.selectProvider('stripe');
            expect(component.selectedProvider()).toBe('stripe');
        });
    });

    describe('Reset de selectedProvider', () => {
        it('debe resetear selectedProvider cuando open pasa a false', () => {
            // Abrir el modal y seleccionar un provider
            fixture.componentRef.setInput('open', true);
            fixture.detectChanges();
            
            component.selectProvider('paypal');
            expect(component.selectedProvider()).toBe('paypal');

            // Simular que el modal se cierra
            fixture.componentRef.setInput('open', false);
            fixture.detectChanges();

            // Debe estar reseteado
            expect(component.selectedProvider()).toBeNull();
        });

        it('debe resetear selectedProvider cuando cambia eventId', () => {
            // Configurar primer evento
            fixture.componentRef.setInput('event', mockEvent1);
            fixture.detectChanges();

            // Seleccionar un provider
            component.selectProvider('paypal');
            expect(component.selectedProvider()).toBe('paypal');

            // Cambiar a un nuevo evento con diferente eventId
            fixture.componentRef.setInput('event', mockEvent2);
            fixture.detectChanges();

            // Debe estar reseteado
            expect(component.selectedProvider()).toBeNull();
        });

        it('NO debe resetear selectedProvider si eventId es el mismo', () => {
            // Configurar evento
            fixture.componentRef.setInput('event', mockEvent1);
            fixture.detectChanges();

            // Seleccionar un provider
            component.selectProvider('paypal');
            expect(component.selectedProvider()).toBe('paypal');

            // Cambiar el mismo evento (mismo eventId pero diferente contenido)
            const sameEventId = { ...mockEvent1, timestamp: Date.now() };
            fixture.componentRef.setInput('event', sameEventId);
            fixture.detectChanges();

            // NO debe estar reseteado (mismo eventId)
            expect(component.selectedProvider()).toBe('paypal');
        });
    });

    describe('Confirm y Cancel', () => {
        it('debe emitir confirm con el provider seleccionado', () => {
            const spy = vi.fn();
            component.confirm.subscribe(spy);

            component.selectProvider('paypal');
            component.onConfirm();

            expect(spy).toHaveBeenCalledWith('paypal');
            expect(component.selectedProvider()).toBeNull();
        });

        it('debe emitir cancel', () => {
            const spy = vi.fn();
            component.cancel.subscribe(spy);

            component.selectProvider('paypal');
            component.onCancel();

            expect(spy).toHaveBeenCalled();
            expect(component.selectedProvider()).toBeNull();
        });

        it('no debe emitir confirm si no hay provider seleccionado', () => {
            const spy = vi.fn();
            component.confirm.subscribe(spy);

            component.onConfirm();

            expect(spy).not.toHaveBeenCalled();
        });
    });

    describe('Computed properties', () => {
        it('debe calcular errorMessage correctamente', () => {
            fixture.componentRef.setInput('event', mockEvent1);
            fixture.detectChanges();

            expect(component.errorMessage()).toBe('Provider unavailable');
        });

        it('debe retornar null si no hay error', () => {
            const eventWithoutError = { ...mockEvent1, error: null };
            fixture.componentRef.setInput('event', eventWithoutError);
            fixture.detectChanges();

            expect(component.errorMessage()).toBeNull();
        });

        it('debe calcular alternativeProviders correctamente', () => {
            fixture.componentRef.setInput('event', mockEvent1);
            fixture.detectChanges();

            const providers = component.alternativeProviders();
            expect(providers.length).toBeGreaterThan(0);
            expect(providers.some(p => p.id === 'paypal')).toBe(true);
        });

        it('debe calcular selectedProviderName correctamente', () => {
            component.selectProvider('paypal');
            const name = component.selectedProviderName();
            expect(name).toBeTruthy();
        });

        it('debe retornar null si no hay provider seleccionado', () => {
            expect(component.selectedProviderName()).toBeNull();
        });
    });
});
