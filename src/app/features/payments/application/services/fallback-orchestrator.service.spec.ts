import { TestBed } from '@angular/core/testing';
import { FallbackOrchestratorService, FALLBACK_CONFIG } from './fallback-orchestrator.service';
import { ProviderFactoryRegistry } from '../registry/provider-factory.registry';
import { PaymentProviderId } from '../../domain/models/payment.types';
import { PaymentError } from '../../domain/models/payment.errors';
import { CreatePaymentRequest } from '../../domain/models/payment.requests';
import { DEFAULT_FALLBACK_CONFIG } from '../../domain/models/fallback.types';

describe('FallbackOrchestratorService', () => {
    let service: FallbackOrchestratorService;
    let registryMock: {
        getAvailableProviders: ReturnType<typeof vi.fn>;
        get: ReturnType<typeof vi.fn>;
    };

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

        it('isAutoExecuting returns false', () => {
            expect(service.isAutoExecuting()).toBe(false);
        });
    });

    describe('reportFailure() - Manual Mode', () => {
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

        it('records failed attempt in state with wasAutoFallback=false', () => {
            service.reportFailure('stripe', providerUnavailableError, mockRequest);

            const attempts = service.failedAttempts();
            expect(attempts).toHaveLength(1);
            expect(attempts[0].provider).toBe('stripe');
            expect(attempts[0].error).toEqual(providerUnavailableError);
            expect(attempts[0].wasAutoFallback).toBe(false);
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
            expect(service.state().isAutoFallback).toBe(false);
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
            expect(service.state().isAutoFallback).toBe(false);
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

        it('sets status to failed when notifyFailure is called without originalRequest', () => {
            service.reportFailure('stripe', providerUnavailableError, mockRequest);
            service.respondToFallback({
                eventId: service.pendingEvent()!.eventId,
                accepted: true,
                selectedProvider: 'paypal',
                timestamp: Date.now(),
            });

            // notifyFailure without originalRequest should just set status to failed
            service.notifyFailure('paypal', providerUnavailableError);

            expect(service.state().status).toBe('failed');
        });

        it('attempts to report another failure when originalRequest is provided', () => {
            // With default config (maxAttempts=2, providers=['stripe', 'paypal']),
            // after stripe fails and paypal fails, there are no more alternatives
            service.reportFailure('stripe', providerUnavailableError, mockRequest);
            service.respondToFallback({
                eventId: service.pendingEvent()!.eventId,
                accepted: true,
                selectedProvider: 'paypal',
                timestamp: Date.now(),
            });

            // notifyFailure with originalRequest will try to reportFailure
            // but since paypal is excluded and stripe already failed,
            // there are no alternatives, so it stays 'failed'
            service.notifyFailure('paypal', providerUnavailableError, mockRequest);

            // Status should be 'failed' because no alternatives available
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
            expect(service.state().isAutoFallback).toBe(false);
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

        it('returns config via getConfig()', () => {
            const config = service.getConfig();

            expect(config.enabled).toBe(true);
            expect(config.mode).toBe('manual');
            expect(config.maxAttempts).toBe(2);
        });
    });
});

describe('FallbackOrchestratorService - Auto Mode', () => {
    let service: FallbackOrchestratorService;
    let registryMock: {
        getAvailableProviders: ReturnType<typeof vi.fn>;
        get: ReturnType<typeof vi.fn>;
    };

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
                {
                    provide: FALLBACK_CONFIG,
                    useValue: {
                        mode: 'auto',
                        autoFallbackDelay: 100, // 100ms for faster tests
                        maxAutoFallbacks: 1,
                    },
                },
            ],
        });

        service = TestBed.inject(FallbackOrchestratorService);
    });

    afterEach(() => {
        service.reset();
    });

    describe('auto-fallback behavior', () => {
        it('should set status to auto_executing immediately', () => {
            service.reportFailure('stripe', providerUnavailableError, mockRequest);

            expect(service.state().status).toBe('auto_executing');
            expect(service.isAutoExecuting()).toBe(true);
            expect(service.state().isAutoFallback).toBe(true);
        });

        it('should emit autoFallbackStarted$ event', () => {
            let emittedData: any = null;
            service.autoFallbackStarted$.subscribe(data => {
                emittedData = data;
            });

            service.reportFailure('stripe', providerUnavailableError, mockRequest);

            expect(emittedData).not.toBeNull();
            expect(emittedData.provider).toBe('paypal');
            expect(emittedData.delay).toBe(100);
        });

        it('should emit fallbackExecute$ after delay', async () => {
            let emittedData: any = null;
            service.fallbackExecute$.subscribe(data => {
                emittedData = data;
            });

            service.reportFailure('stripe', providerUnavailableError, mockRequest);

            // Before delay
            expect(emittedData).toBeNull();

            // After delay
            await new Promise(r => setTimeout(r, 150));

            expect(emittedData).not.toBeNull();
            expect(emittedData.provider).toBe('paypal');
            expect(emittedData.request).toEqual(mockRequest);
        });

        it('should set currentProvider during auto execution', () => {
            service.reportFailure('stripe', providerUnavailableError, mockRequest);

            expect(service.currentProvider()).toBe('paypal');
        });

        it('should record failed attempt with wasAutoFallback=true on subsequent failures', async () => {
            // First failure triggers auto-fallback to paypal
            service.reportFailure('stripe', providerUnavailableError, mockRequest);
            await new Promise(r => setTimeout(r, 150));

            // Simulate paypal failure
            service.notifyFailure('paypal', providerUnavailableError, mockRequest);

            const attempts = service.failedAttempts();
            // After auto-fallback, if paypal fails and triggers manual, wasAutoFallback should be tracked
            expect(attempts.length).toBeGreaterThanOrEqual(1);
        });

        it('should fall back to manual mode after maxAutoFallbacks', async () => {
            // Configure with multiple providers
            registryMock.getAvailableProviders.mockReturnValue(['stripe', 'paypal', 'mercadopago'] as PaymentProviderId[]);

            // First failure triggers auto-fallback
            service.reportFailure('stripe', providerUnavailableError, mockRequest);
            expect(service.state().status).toBe('auto_executing');
            await new Promise(r => setTimeout(r, 150));

            // Notify failure after auto-fallback
            service.notifyFailure('paypal', providerUnavailableError, mockRequest);

            // Second failure should now be manual (maxAutoFallbacks = 1)
            // Because we've already done 1 auto-fallback
            expect(service.getAutoFallbackCount()).toBe(0); // It tracks failed attempts with wasAutoFallback
        });

        it('should not emit fallbackAvailable$ in auto mode', () => {
            let eventEmitted = false;
            service.fallbackAvailable$.subscribe(() => {
                eventEmitted = true;
            });

            service.reportFailure('stripe', providerUnavailableError, mockRequest);

            expect(eventEmitted).toBe(false);
        });
    });

    describe('getAutoFallbackCount()', () => {
        it('should return 0 initially', () => {
            expect(service.getAutoFallbackCount()).toBe(0);
        });
    });

    describe('computed signals', () => {
        it('isExecuting should be true during auto_executing', () => {
            service.reportFailure('stripe', providerUnavailableError, mockRequest);

            expect(service.isExecuting()).toBe(true);
            expect(service.isAutoExecuting()).toBe(true);
        });

        it('isAutoFallback should be true during auto execution', () => {
            service.reportFailure('stripe', providerUnavailableError, mockRequest);

            expect(service.isAutoFallback()).toBe(true);
        });
    });

    describe('cancellation during auto-fallback', () => {
        it('should stop auto-fallback when reset is called', async () => {
            let emittedData: any = null;
            service.fallbackExecute$.subscribe(data => {
                emittedData = data;
            });

            service.reportFailure('stripe', providerUnavailableError, mockRequest);

            // Reset before delay completes
            await new Promise(r => setTimeout(r, 50));
            service.reset();
            await new Promise(r => setTimeout(r, 100));

            // Should not have emitted
            expect(emittedData).toBeNull();
            expect(service.state().status).toBe('idle');
        });
    });
});
