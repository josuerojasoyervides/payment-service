import { TestBed } from '@angular/core/testing';
import { ProviderFactory } from '../../domain/ports/provider-factory.port';
import { ProviderFactoryRegistry } from './provider-factory.registry';
import { PAYMENT_PROVIDER_FACTORIES } from '../tokens/payment-provider-factories.token';
describe('ProviderFactoryRegistry', () => {
    let registry: ProviderFactoryRegistry;

    const stripeFactoryMock: ProviderFactory = {
        providerId: 'stripe',
        createStrategy: vi.fn(),
    };

    const paypalFactoryMock: ProviderFactory = {
        providerId: 'paypal',
        createStrategy: vi.fn(),
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                ProviderFactoryRegistry,

                // ✅ Multi DI real, pero con mocks
                { provide: PAYMENT_PROVIDER_FACTORIES, useValue: stripeFactoryMock, multi: true },
                { provide: PAYMENT_PROVIDER_FACTORIES, useValue: paypalFactoryMock, multi: true },
            ],
        })

        registry = TestBed.inject(ProviderFactoryRegistry);
    })

    it('should retrieve the correct provider factory', () => {
        const factory = registry.get('paypal');
        expect(factory.providerId).toBe('paypal');
    })

    it('should throw an error if provider factory is not found', () => {
        expect(() =>
            registry.get('unknown' as any)
        ).toThrowError('Provider factory for unknown not found.');
    })

    it('injects factories as an array (multi provider)', () => {
        // si esto pasa, tu wiring es correcto
        const stripe = registry.get('stripe');
        const paypal = registry.get('paypal');

        expect(stripe).toBe(stripeFactoryMock);
        expect(paypal).toBe(paypalFactoryMock);
    });

    it('throws if provider is not registered', () => {
        expect(() => registry.get('square' as any)).toThrowError('Provider factory for square not found.');
    });

    it('throws when duplicate factories for same providerId exist', () => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [
                ProviderFactoryRegistry,
                { provide: PAYMENT_PROVIDER_FACTORIES, useValue: { providerId: 'stripe', createStrategy: vi.fn() }, multi: true },
                { provide: PAYMENT_PROVIDER_FACTORIES, useValue: { providerId: 'stripe', createStrategy: vi.fn() }, multi: true },
            ],
        });

        const registry = TestBed.inject(ProviderFactoryRegistry);

        expect(() => registry.get('stripe')).toThrowError('Duplicate provider factories for stripe.');
    });
})