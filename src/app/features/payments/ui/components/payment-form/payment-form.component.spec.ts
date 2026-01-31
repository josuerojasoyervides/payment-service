import { Component, input } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { FieldTree } from '@angular/forms/signals';
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

function getTextFieldOrThrow(component: PaymentFormComponent, name: string): FieldTree<string> {
  const field = component.textField(name);
  if (!field) throw new Error(`Text field not found: ${name}`);
  return field;
}

function getFlagFieldOrThrow(component: PaymentFormComponent, name: string): FieldTree<boolean> {
  const field = component.flagField(name);
  if (!field) throw new Error(`Flag field not found: ${name}`);
  return field;
}

/**
 * Determinista y sin timers. Útil si el effect de outputs
 * se ejecuta en microtask (depende del scheduler interno).
 */
async function flushMicrotasks(times = 2): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

describe('PaymentFormComponent', () => {
  let hostFixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let component: PaymentFormComponent;

  beforeEach(async () => {
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
    hostFixture?.destroy();
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

      const descriptionField = getTextFieldOrThrow(component, 'description');
      descriptionField().value.set('hello');

      hostFixture.detectChanges();
      await flushMicrotasks();

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

      const descriptionField = getTextFieldOrThrow(component, 'description');
      descriptionField().value.set('   ');

      hostFixture.detectChanges();
      await flushMicrotasks();

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

      const saveForFutureField = getFlagFieldOrThrow(component, 'saveForFuture');
      saveForFutureField().value.set(true);

      hostFixture.detectChanges();
      await flushMicrotasks();

      expect(host.lastOptions.saveForFuture).toBe(true);
    });
  });
});
