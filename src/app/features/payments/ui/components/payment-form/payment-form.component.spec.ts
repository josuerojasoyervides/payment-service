import { Component, input } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { I18nService } from '@core/i18n';
import type {
  FieldRequirements,
  PaymentOptions,
} from '@payments/domain/subdomains/payment/ports/payment-request-builder.port';
import { PaymentFormComponent } from '@payments/ui/components/payment-form/payment-form.component';

const mockI18n: Pick<I18nService, 't'> = {
  t: (key: string) => key,
};

@Component({
  selector: 'app-test-host',
  standalone: true,
  imports: [PaymentFormComponent],
  template: ` <app-payment-form [requirements]="reqs()" (formChange)="onFormChange($event)" /> `,
})
class TestHostComponent {
  reqs = input<FieldRequirements | null>(null);
  lastOptions: PaymentOptions = {};

  onFormChange(opts: PaymentOptions): void {
    this.lastOptions = opts;
  }
}

describe('PaymentFormComponent', () => {
  let hostFixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let component: PaymentFormComponent;

  beforeEach(async () => {
    vi.useRealTimers();

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [{ provide: I18nService, useValue: mockI18n }],
    }).compileComponents();

    hostFixture = TestBed.createComponent(TestHostComponent);
    host = hostFixture.componentInstance;
    component = hostFixture.debugElement.query(
      By.directive(PaymentFormComponent),
    ).componentInstance;
  });

  afterEach(() => {
    // Avoid leaking anything to other specs.
    hostFixture?.destroy();
    vi.useRealTimers();
  });

  describe('dynamic PaymentOptions from FieldRequirements.fields', () => {
    it('emits arbitrary field (e.g. description) when set', async () => {
      const reqs: FieldRequirements = {
        fields: [
          { name: 'description', type: 'text', required: false, labelKey: 'ui.description' },
          { name: 'customerEmail', type: 'email', required: false, labelKey: 'ui.email' },
        ],
      };
      hostFixture.componentRef.setInput('reqs', reqs);
      hostFixture.detectChanges();

      component.form.get('description')?.setValue('hello');
      hostFixture.detectChanges();
      await new Promise((r) => setTimeout(r, 200));

      expect(host.lastOptions.description).toBe('hello');
    });

    it('omits empty optional strings (whitespace-only)', async () => {
      const reqs: FieldRequirements = {
        fields: [
          { name: 'description', type: 'text', required: false, labelKey: 'ui.description' },
        ],
      };
      hostFixture.componentRef.setInput('reqs', reqs);
      hostFixture.detectChanges();

      component.form.get('description')?.setValue('   ');
      hostFixture.detectChanges();
      await new Promise((r) => setTimeout(r, 200));

      expect(host.lastOptions.description).toBeUndefined();
    });

    it('emits boolean saveForFuture when control is true', async () => {
      const reqs: FieldRequirements = {
        fields: [
          {
            name: 'saveForFuture',
            type: 'hidden',
            required: false,
            labelKey: 'ui.save_for_future',
          },
        ],
      };
      hostFixture.componentRef.setInput('reqs', reqs);
      hostFixture.detectChanges();

      component.form.get('saveForFuture')?.setValue(true);
      await new Promise((r) => setTimeout(r, 200));

      expect(host.lastOptions.saveForFuture).toBe(true);
    });
  });
});
