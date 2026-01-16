import { TestBed } from '@angular/core/testing';
import { ProviderFactory } from '../../domain/ports/provider-factory.port';
import { ProviderFactoryRegistry } from './provider-factory.registry';
import { PAYMENT_PROVIDER_FACTORIES } from '../tokens/providers.token';
describe('ProviderFactoryRegistry', () => {
    let registry: ProviderFactoryRegistry;
    const mockFactories = [
        { providerId: 'paypal', createStrategy: vi.fn() },
        { providerId: 'stripe', createStrategy: vi.fn() }
    ];

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                ProviderFactoryRegistry,
                { provide: PAYMENT_PROVIDER_FACTORIES, useValue: mockFactories as ProviderFactory[] }
            ]
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

    it('returns the exact factory instance from the list', () => {
        const paypalFactoryRef = mockFactories[0] as any;

        expect(registry.get('paypal')).toBe(paypalFactoryRef);
    });

    it('throws when factories list is empty', () => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [
                ProviderFactoryRegistry,
                { provide: PAYMENT_PROVIDER_FACTORIES, useValue: [] as ProviderFactory[] },
            ],
        });

        registry = TestBed.inject(ProviderFactoryRegistry);

        expect(() => registry.get('stripe')).toThrow();
    });

})