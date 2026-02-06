import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '@core/i18n';
import { createPaymentIntentId } from '@payments/application/api/testing/vo-test-helpers';
import type { PaymentIntent } from '@payments/domain/subdomains/payment/entities/payment-intent.types';
import { PaymentIntentCardComponent } from '@payments/ui/components/payment-intent-card/payment-intent-card.component';

describe('PaymentIntentCardComponent', () => {
  let fixture: ComponentFixture<PaymentIntentCardComponent>;

  const mockI18n = {
    t: vi.fn((key: string) => key),
    setLanguage: vi.fn(),
    getLanguage: vi.fn(() => 'es'),
    has: vi.fn(() => true),
    currentLang: { asReadonly: vi.fn() } as any,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentIntentCardComponent],
      providers: [{ provide: I18nService, useValue: mockI18n }],
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentIntentCardComponent);
  });

  it('renders intent id value instead of [object Object]', () => {
    const intent: PaymentIntent = {
      id: createPaymentIntentId('pi_test_123'),
      provider: 'stripe',
      status: 'requires_action',
      money: { amount: 100, currency: 'MXN' },
    };

    fixture.componentRef.setInput('intent', intent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('pi_test_123');
    expect(text).not.toContain('[object Object]');
  });

  it('hides manual refresh by default', () => {
    const intent: PaymentIntent = {
      id: createPaymentIntentId('pi_test_456'),
      provider: 'stripe',
      status: 'requires_action',
      money: { amount: 100, currency: 'MXN' },
    };

    fixture.componentRef.setInput('intent', intent);
    fixture.detectChanges();

    const refreshButton = fixture.nativeElement.querySelector('[data-testid="intent-refresh"]');
    expect(refreshButton).toBeNull();
  });
});
