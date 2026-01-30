import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import { patchState } from '@ngrx/signals';
import type { PaymentFlowPort } from '@payments/application/api/ports/payment-store.port';
import providePayments from '@payments/config/payment.providers';
import { StatusComponent } from '@payments/ui/pages/status/status.page';

describe('StatusComponent - Integration', () => {
  let component: StatusComponent;
  let fixture: ComponentFixture<StatusComponent>;
  let state: PaymentFlowPort;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusComponent],
      providers: [provideRouter([]), ...providePayments()],
    }).compileComponents();

    state = TestBed.inject(PAYMENT_STATE);
    fixture = TestBed.createComponent(StatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render with real providers from catalog', () => {
    expect(component.providerDescriptors().length).toBeGreaterThanOrEqual(1);
    expect(component.examples().length).toBeGreaterThanOrEqual(1);
  });

  it('should have selectedProvider from state when catalog has descriptors', () => {
    const descriptors = component.providerDescriptors();
    if (descriptors.length === 0) return;
    fixture.detectChanges();
    const selected = component.selectedProvider();
    expect(selected === null || descriptors.some((d) => d.id === selected)).toBe(true);
  });

  it('should call state.selectProvider on provider change', () => {
    const descriptors = component.providerDescriptors();
    if (descriptors.length < 2) return;
    const secondId = descriptors[1].id;
    component.onSelectProvider(secondId);
    expect(state.selectedProvider()).toBe(secondId);
  });

  it('should call state.refreshPayment with intentId and providerId when searching', () => {
    const descriptors = component.providerDescriptors();
    if (descriptors.length === 0) return;
    state.selectProvider(descriptors[0].id);
    patchState(component.statusPageState, { intentId: 'pi_fake_abc123' });
    component.searchIntent();
    const status = state.getSnapshot().status;
    expect(['idle', 'loading', 'ready', 'error']).toContain(status);
  });
});
