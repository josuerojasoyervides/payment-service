import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import type { PaymentFlowPort } from '@payments/application/api/ports/payment-store.port';
import providePayments from '@payments/config/payment.providers';
import { ReturnComponent } from '@payments/ui/pages/return/return.page';

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
    expect(state.getSnapshot().status === 'loading' || state.intent() !== null).toBe(true);
  });
});
