import { TestBed } from '@angular/core/testing';
import { FallbackOrchestratorService, FALLBACK_CONFIG } from './fallback-orchestrator.service';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { PaymentProviderId } from '../../domain/models/payment.types';
import { PaymentError } from '../../domain/models/payment.errors';
import { CreatePaymentRequest } from '../../domain/models/payment.requests';
import { DEFAULT_FALLBACK_CONFIG } from '../../domain/models/fallback.types';

describe('FallbackOrchestratorService', () => {
    let service: FallbackOrchestratorService;
    let registryMock: any;

    const mockRequest: CreatePaymentRequest = {
        orderId: 'order_123',
        amount: 100,
        currency: 'MXN',
        method: { type: 'card', token: 'tok_test1234567890abc' },
    };

    const providerUnavailableError: PaymentError = {
        code: 'provider_unavailable',
        message: 'Provider not available',
        raw: undefined,
    };

    const cardDeclinedError: PaymentError = {
        code: 'card_declined',
        message: 'Card was declined',
        raw: undefined,
    };

    beforeEach(() => {
        registryMock = {
            getAvailableProviders: vi.fn((): PaymentProviderId[] => ['stripe', 'paypal']),
            get: vi.fn((providerId: PaymentProviderId) => ({
                providerId,
                supportsMethod: vi.fn(() => true),
            })),
        };

        TestBed.configureTestingModule({
            providers: [
                FallbackOrchestratorService,
                { provide: ProviderFactoryRegistry, useValue: registryMock },
            ],
        });

        service = TestBed.inject(FallbackOrchestratorService);
    });

    afterEach(() => {
        service.reset();
    });

    describe('initial state', () => {
        it('starts with idle status', () => {
            expect(service.state().status).toBe('idle');
        });

        it('has no pending event', () => {
            expect(service.pendingEvent()).toBeNull();
        });

        it('has empty failed attempts', () => {
            expect(service.failedAttempts()).toEqual([]);
        });

        it('isPending returns false', () => {
            expect(service.isPending()).toBe(false);
        });
    });

    describe('reportFailure()', () => {
        it('returns true and emits event when error is eligible and alternatives exist', () => {
            let emittedEvent: any = null;
            service.fallbackAvailable$.subscribe(event => {
                emittedEvent = event;
            });

            const result = service.reportFailure('stripe', providerUnavailableError, mockRequest);

            expect(result).toBe(true);
            expect(emittedEvent).not.toBeNull();
            expect(emittedEvent.failedProvider).toBe('stripe');
            expect(emittedEvent.alternativeProviders).toContain('paypal');
        });

        it('returns false when error code is not eligible for fallback', () => {
            const result = service.reportFailure('stripe', cardDeclinedError, mockRequest);

            expect(result).toBe(false);
            expect(service.state().status).toBe('idle');
        });

        it('returns false when no alternative providers available', () => {
            registryMock.getAvailableProviders.mockReturnValue(['stripe']);

            const result = service.reportFailure('stripe', providerUnavailableError, mockRequest);

            expect(result).toBe(false);
        });

        it('updates state to pending when fallback is available', () => {
            service.reportFailure('stripe', providerUnavailableError, mockRequest);

            expect(service.state().status).toBe('pending');
            expect(service.isPending()).toBe(true);
        });

        it('records failed attempt in state', () => {
            service.reportFailure('stripe', providerUnavailableError, mockRequest);

            const attempts = service.failedAttempts();
            expect(attempts).toHaveLength(1);
            expect(attempts[0].provider).toBe('stripe');
            expect(attempts[0].error).toEqual(providerUnavailableError);
        });

        it('excludes already failed providers from alternatives', () => {
            // First failure
            service.reportFailure('stripe', providerUnavailableError, mockRequest);

            // Respond to continue
            const event = service.pendingEvent()!;
            service.respondToFallback({
                eventId: event.eventId,
                accepted: true,
                selectedProvider: 'paypal',
                timestamp: Date.now(),
            });

            // Reset to test second failure
            service['_state'].update(s => ({ ...s, status: 'idle', pendingEvent: null }));

            // Second failure with paypal
            const paypalError: PaymentError = { code: 'provider_unavailable', message: 'PayPal down', raw: undefined };
            const result = service.reportFailure('paypal', paypalError, mockRequest);

            // No more alternatives (both stripe and paypal failed)
            expect(result).toBe(false);
        });

        it('respects maxAttempts configuration', () => {
            // First failure
            service.reportFailure('stripe', providerUnavailableError, mockRequest);
            service.respondToFallback({
                eventId: service.pendingEvent()!.eventId,
                accepted: true,
                selectedProvider: 'paypal',
                timestamp: Date.now(),
            });

            // Second failure - should hit max attempts (default is 2)
            service['_state'].update(s => ({ ...s, status: 'idle', pendingEvent: null }));
            const result = service.reportFailure('paypal', providerUnavailableError, mockRequest);

            expect(result).toBe(false);
        });
    });

    describe('respondToFallback()', () => {
        beforeEach(() => {
            service.reportFailure('stripe', providerUnavailableError, mockRequest);
        });

        it('updates state to executing when user accepts', () => {
            const event = service.pendingEvent()!;

            service.respondToFallback({
                eventId: event.eventId,
                accepted: true,
                selectedProvider: 'paypal',
                timestamp: Date.now(),
            });

            expect(service.state().status).toBe('executing');
            expect(service.state().currentProvider).toBe('paypal');
        });

        it('updates state to cancelled when user declines', () => {
            const event = service.pendingEvent()!;

            service.respondToFallback({
                eventId: event.eventId,
                accepted: false,
                timestamp: Date.now(),
            });

            expect(service.state().status).toBe('cancelled');
        });

        it('clears pending event after response', () => {
            const event = service.pendingEvent()!;

            service.respondToFallback({
                eventId: event.eventId,
                accepted: true,
                selectedProvider: 'paypal',
                timestamp: Date.now(),
            });

            expect(service.pendingEvent()).toBeNull();
        });

        it('emits fallbackExecute$ when user accepts', () => {
            let emittedData: any = null;
            service.fallbackExecute$.subscribe(data => {
                emittedData = data;
            });

            const event = service.pendingEvent()!;
            service.respondToFallback({
                eventId: event.eventId,
                accepted: true,
                selectedProvider: 'paypal',
                timestamp: Date.now(),
            });

            expect(emittedData).not.toBeNull();
            expect(emittedData.provider).toBe('paypal');
            expect(emittedData.request).toEqual(mockRequest);
        });

        it('ignores response for unknown eventId', () => {
            const originalStatus = service.state().status;

            service.respondToFallback({
                eventId: 'unknown_event',
                accepted: true,
                selectedProvider: 'paypal',
                timestamp: Date.now(),
            });

            expect(service.state().status).toBe(originalStatus);
        });
    });

    describe('notifySuccess()', () => {
        it('updates state to completed', () => {
            service.reportFailure('stripe', providerUnavailableError, mockRequest);
            service.respondToFallback({
                eventId: service.pendingEvent()!.eventId,
                accepted: true,
                selectedProvider: 'paypal',
                timestamp: Date.now(),
            });

            service.notifySuccess();

            expect(service.state().status).toBe('completed');
        });
    });

    describe('notifyFailure()', () => {
        it('updates state to failed', () => {
            service.reportFailure('stripe', providerUnavailableError, mockRequest);
            service.respondToFallback({
                eventId: service.pendingEvent()!.eventId,
                accepted: true,
                selectedProvider: 'paypal',
                timestamp: Date.now(),
            });

            service.notifyFailure('paypal', providerUnavailableError);

            expect(service.state().status).toBe('failed');
        });
    });

    describe('reset()', () => {
        it('resets state to initial', () => {
            service.reportFailure('stripe', providerUnavailableError, mockRequest);

            service.reset();

            expect(service.state().status).toBe('idle');
            expect(service.pendingEvent()).toBeNull();
            expect(service.failedAttempts()).toEqual([]);
        });
    });

    describe('getSnapshot()', () => {
        it('returns current state', () => {
            const snapshot = service.getSnapshot();

            expect(snapshot.status).toBe('idle');
            expect(snapshot.pendingEvent).toBeNull();
        });
    });

    describe('timeout behavior', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('auto-cancels after timeout if no response', () => {
            service.reportFailure('stripe', providerUnavailableError, mockRequest);

            expect(service.state().status).toBe('pending');

            // Advance time past the timeout (default 30 seconds)
            vi.advanceTimersByTime(DEFAULT_FALLBACK_CONFIG.userResponseTimeout + 100);

            expect(service.state().status).toBe('cancelled');
        });
    });

    describe('configuration', () => {
        it('can be configured with custom config', () => {
            TestBed.resetTestingModule();
            TestBed.configureTestingModule({
                providers: [
                    FallbackOrchestratorService,
                    { provide: ProviderFactoryRegistry, useValue: registryMock },
                    { provide: FALLBACK_CONFIG, useValue: { enabled: false } },
                ],
            });

            const configuredService = TestBed.inject(FallbackOrchestratorService);

            // Should not trigger fallback when disabled
            const result = configuredService.reportFailure('stripe', providerUnavailableError, mockRequest);

            expect(result).toBe(false);
        });
    });
});
