import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { createMockPaymentState } from '@app/features/payments/application/api/testing/provide-mock-payment-state.harness';
import { PAYMENT_STATE } from '@app/features/payments/application/api/tokens/store/payment-state.token';
import { I18nService } from '@core/i18n';
import { FlowDebugPanelComponent } from '@payments/ui/components/flow-debug-panel/flow-debug-panel.component';

describe('FlowDebugPanelComponent', () => {
  let component: FlowDebugPanelComponent;
  let fixture: ComponentFixture<FlowDebugPanelComponent>;

  beforeEach(async () => {
    const mockState = createMockPaymentState();

    await TestBed.configureTestingModule({
      imports: [FlowDebugPanelComponent],
      providers: [
        { provide: PAYMENT_STATE, useValue: mockState },
        {
          provide: I18nService,
          useValue: {
            t: (k: string) => k,
            has: () => true,
            setLanguage: () => {},
            getLanguage: () => 'en',
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FlowDebugPanelComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose debugSummary from state and render when in dev mode', () => {
    fixture.detectChanges();
    const summary = component.debugSummary();
    expect(summary).toBeDefined();
    expect(summary.status).toBeDefined();
    expect(summary.provider).toBeNull();
    expect(summary.intentId).toBeNull();
    expect(summary.historyCount).toBe(0);
    if (component.isDevMode) {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain(summary.status);
    }
  });

  describe('Machine debug (state node, tags, last event)', () => {
    it('renders state node, tags, and last event type from port', () => {
      const mockWithDebug = createMockPaymentState({
        debugStateNode: 'idle',
        debugTags: ['idle', 'ready'],
        debugLastEventType: 'RESET',
        debugLastEventPayload: { type: 'RESET' },
      });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [FlowDebugPanelComponent],
        providers: [
          { provide: PAYMENT_STATE, useValue: mockWithDebug },
          {
            provide: I18nService,
            useValue: {
              t: (k: string) => k,
              has: () => true,
              setLanguage: () => {},
              getLanguage: () => 'en',
            },
          },
        ],
      }).compileComponents();
      fixture = TestBed.createComponent(FlowDebugPanelComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const stateNodeEl = el.querySelector('[data-testid="debug-state-node"]');
      const tagsEl = el.querySelector('[data-testid="debug-tags"]');
      const lastEventTypeEl = el.querySelector('[data-testid="debug-last-event-type"]');
      const lastEventPayloadEl = el.querySelector('[data-testid="debug-last-event-payload"]');

      expect(stateNodeEl).toBeTruthy();
      expect(stateNodeEl?.textContent?.trim()).toBe('idle');
      expect(tagsEl).toBeTruthy();
      expect(tagsEl?.textContent).toContain('idle');
      expect(tagsEl?.textContent).toContain('ready');
      expect(lastEventTypeEl).toBeTruthy();
      expect(lastEventTypeEl?.textContent?.trim()).toBe('RESET');
      expect(lastEventPayloadEl).toBeTruthy();
      expect(lastEventPayloadEl?.textContent).toContain('RESET');
    });
  });
});
