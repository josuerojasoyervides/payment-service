import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '@core/i18n';
import { createPaymentIntentId } from '@payments/application/api/testing/vo-test-helpers';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import { PaymentResultComponent } from '@payments/ui/components/payment-result/payment-result.component';

describe('PaymentResultComponent', () => {
  let fixture: ComponentFixture<PaymentResultComponent>;

  const mockI18n = {
    t: vi.fn((key: string) => key),
    setLanguage: vi.fn(),
    getLanguage: vi.fn(() => 'es'),
    has: vi.fn(() => true),
    currentLang: { asReadonly: vi.fn() } as any,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentResultComponent],
      providers: [{ provide: I18nService, useValue: mockI18n }],
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentResultComponent);
  });

  it('renders intent id value instead of [object Object]', () => {
    const intent: PaymentIntent = {
      id: createPaymentIntentId('pi_result_456'),
      provider: 'stripe',
      status: 'processing',
      money: { amount: 100, currency: 'MXN' },
    };

    fixture.componentRef.setInput('intent', intent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('pi_result_456');
    expect(text).not.toContain('[object Object]');
  });

  it('disables new payment while processing', () => {
    const intent: PaymentIntent = {
      id: createPaymentIntentId('pi_result_789'),
      provider: 'stripe',
      status: 'processing',
      money: { amount: 200, currency: 'MXN' },
    };

    fixture.componentRef.setInput('intent', intent);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'button.btn-success',
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(true);
  });

  it('enables new payment when succeeded', () => {
    const intent: PaymentIntent = {
      id: createPaymentIntentId('pi_result_900'),
      provider: 'stripe',
      status: 'succeeded',
      money: { amount: 300, currency: 'MXN' },
    };

    fixture.componentRef.setInput('intent', intent);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'button.btn-success',
    ) as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(false);
  });
});
