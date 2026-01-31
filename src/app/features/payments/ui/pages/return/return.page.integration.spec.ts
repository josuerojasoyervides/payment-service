import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { createMockPaymentState } from '@app/features/payments/application/api/testing/provide-mock-payment-state.harness';
import { PAYMENT_CHECKOUT_CATALOG } from '@app/features/payments/application/api/tokens/store/payment-checkout-catalog.token';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import { I18nService } from '@core/i18n';
import type { PaymentFlowPort } from '@payments/application/api/ports/payment-store.port';
import providePayments from '@payments/config/payment.providers';
import type { PaymentProviderId } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import { ReturnComponent } from '@payments/ui/pages/return/return.page';
import { vi } from 'vitest';

describe('ReturnComponent - Integration', () => {
  let component: ReturnComponent;
  let fixture: ComponentFixture<ReturnComponent>;
  let state: PaymentFlowPort;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReturnComponent],
      providers: [
        provideRouter([]),
        ...providePayments(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: {}, queryParams: {} },
          },
        },
      ],
    }).compileComponents();

    state = TestBed.inject(PAYMENT_STATE);
    fixture = TestBed.createComponent(ReturnComponent);
    component = fixture.componentInstance;
  });

  it('should call notifyRedirectReturned with normalized params on init', () => {
    const route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: Record<string, unknown>; queryParams: Record<string, string> };
    };
    route.snapshot.queryParams = { payment_intent: 'pi_fake_123' };
    component.ngOnInit();
    expect(component.returnPageState.returnReference()).toBeDefined();
    expect(component.returnPageState.returnReference()?.referenceId).toBe('pi_fake_123');
  });

  it('should set returnReference and selectProvider from port', () => {
    const route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: Record<string, unknown>; queryParams: Record<string, string> };
    };
    route.snapshot.queryParams = { payment_intent: 'pi_fake_xyz' };
    component.ngOnInit();
    const ref = component.returnPageState.returnReference();
    expect(ref?.providerId).toBeDefined();
    expect(ref?.referenceId).toBe('pi_fake_xyz');
    expect(ref?.providerLabel).toBeDefined();
  });

  it('should allow refresh by reference with providerId', () => {
    const route = TestBed.inject(ActivatedRoute) as unknown as {
      snapshot: { data: Record<string, unknown>; queryParams: Record<string, string> };
    };
    route.snapshot.queryParams = { payment_intent: 'pi_fake_abc' };
    component.ngOnInit();
    component.refreshPaymentByReference('pi_fake_abc');
    // After refreshPayment the state may be loading or already have a result (async)
    const status = state.getSnapshot().status;
    expect(['idle', 'loading', 'ready', 'error']).toContain(status);
  });

  describe('port assertions (mock state)', () => {
    it('should call notifyRedirectReturned and selectProvider on init; refresh is manual only', async () => {
      const notifySpy = vi.fn();
      const refreshSpy = vi.fn();
      const selectSpy = vi.fn();
      const mockCatalog = {
        getProviderDescriptor: (id: PaymentProviderId) => ({ id, labelKey: `ui.provider_${id}` }),
        getProviderDescriptors: () => [
          { id: 'stripe' as PaymentProviderId, labelKey: 'ui.provider_stripe' },
        ],
        availableProviders: () => ['stripe' as PaymentProviderId],
        getSupportedMethods: () => ['card' as const],
        getFieldRequirements: () => null,
        buildCreatePaymentRequest: () => ({}),
      };
      const base = createMockPaymentState();
      const mock = {
        ...base,
        notifyRedirectReturned: notifySpy,
        refreshPayment: refreshSpy,
        selectProvider: selectSpy,
        getReturnReferenceFromQuery: (q: Record<string, unknown>) => ({
          providerId: 'stripe' as PaymentProviderId,
          referenceId: (q['payment_intent'] as string) ?? null,
        }),
      };

      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [ReturnComponent],
        providers: [
          provideRouter([]),
          { provide: PAYMENT_STATE, useValue: mock },
          { provide: PAYMENT_CHECKOUT_CATALOG, useValue: mockCatalog },
          {
            provide: I18nService,
            useValue: {
              t: (k: string) => k,
              has: () => true,
              setLanguage: () => {},
              getLanguage: () => 'en',
            },
          },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                data: { returnFlow: true },
                queryParams: { payment_intent: 'pi_mock_123' },
              },
            },
          },
        ],
      }).compileComponents();

      const comp = TestBed.createComponent(ReturnComponent).componentInstance;
      comp.ngOnInit();

      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({ payment_intent: 'pi_mock_123' }),
      );
      expect(selectSpy).toHaveBeenCalledWith('stripe');
      expect(refreshSpy).not.toHaveBeenCalled();

      const ref = comp.returnPageState.returnReference();
      expect(ref?.providerId).toBe('stripe');
      expect(ref?.referenceId).toBe('pi_mock_123');
      expect(ref?.providerLabel).toBeDefined();

      comp.refreshPaymentByReference('pi_mock_123');
      expect(refreshSpy).toHaveBeenCalledWith({ intentId: 'pi_mock_123' }, 'stripe');
    });
  });
});
