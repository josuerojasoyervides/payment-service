import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '@core/i18n';
import { LoggerService } from '@core/logging';
import { SPEI_DISPLAY_CONFIG } from '@payments/presentation/tokens/spei-display-config.token';
import { NextActionCardComponent } from '@payments/ui/components/next-action-card/next-action-card.component';

describe('NextActionCardComponent', () => {
  let fixture: ComponentFixture<NextActionCardComponent>;
  let _component: NextActionCardComponent;

  const mockI18n: I18nService = {
    t: vi.fn((key: string) => key),
    setLanguage: vi.fn(),
    getLanguage: vi.fn(() => 'en'),
    has: vi.fn(() => true),
  } as any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NextActionCardComponent],
      providers: [
        { provide: I18nService, useValue: mockI18n },
        { provide: LoggerService, useValue: { error: vi.fn() } },
        {
          provide: SPEI_DISPLAY_CONFIG,
          useValue: {
            receivingBanks: { STP: 'STP (Transfers and Payments System)' },
            beneficiaryName: 'Payment Service',
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NextActionCardComponent);
    _component = fixture.componentInstance;
  });

  it('renders redirect action', () => {
    fixture.componentRef.setInput('nextAction', {
      kind: 'redirect',
      url: 'https://example.com/redirect',
    });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const button = el.querySelector('button');
    expect(button?.textContent).toContain('ui.continue_action');
    expect(el.textContent).toContain('https://example.com/redirect');
  });

  it('renders client confirmation action', () => {
    fixture.componentRef.setInput('nextAction', {
      kind: 'client_confirm',
      token: 'token_123',
    });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const button = el.querySelector('button');
    expect(button?.textContent).toContain('ui.confirm_button');
  });

  it('renders manual step details with SPEI instructions component', () => {
    fixture.componentRef.setInput('nextAction', {
      kind: 'manual_step',
      details: {
        bankCode: 'STP',
        clabe: '646180111812345678',
        beneficiaryName: 'Payment Service',
        reference: 'REF123',
        amount: 100,
        currency: 'MXN',
      },
    });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('REF123');
    expect(el.textContent).toContain('STP (Transfers and Payments System)');
  });

  it('renders external wait hint', () => {
    fixture.componentRef.setInput('nextAction', {
      kind: 'external_wait',
      hint: 'Waiting for confirmation',
    });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Waiting for confirmation');
  });
});
