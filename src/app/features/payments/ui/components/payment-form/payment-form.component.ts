import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  isDevMode,
  OnDestroy,
  output,
} from '@angular/core';
import { FormControl, FormRecord, ReactiveFormsModule, Validators } from '@angular/forms';
import { I18nKeys, I18nService } from '@core/i18n';
import { debounceTime, Subject, takeUntil } from 'rxjs';

import {
  FieldRequirement,
  FieldRequirements,
  PaymentOptions,
} from '../../../domain/ports/payment/payment-request-builder.port';

type DynamicControl = FormControl<string | boolean>;
type DynamicForm = FormRecord<DynamicControl>;

/**
 * Dynamic payment form component.
 *
 * Automatically generates fields based on requirements
 * from the selected provider and payment method.
 *
 * @example
 * ```html
 * <app-payment-form
 *   [requirements]="fieldRequirements()"
 *   [disabled]="isLoading()"
 *   (formChange)="onFormChange($event)"
 *   (formValidChange)="onValidChange($event)"
 * />
 * ```
 */
@Component({
  selector: 'app-payment-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './payment-form.component.html',
})
export class PaymentFormComponent implements OnDestroy {
  private readonly i18n = inject(I18nService);

  /** Form field requirements */
  readonly requirements = input<FieldRequirements | null>(null);

  /** Whether the form is disabled */
  readonly disabled = input<boolean>(false);

  /** Emits when form values change */
  readonly formChange = output<PaymentOptions>();

  /** Emits when form validity changes */
  readonly formValidChange = output<boolean>();

  /** Reactive form */
  readonly form: DynamicForm = new FormRecord<DynamicControl>({});

  private readonly destroy$ = new Subject<void>();

  constructor() {
    effect(() => {
      const reqs = this.requirements();
      this.rebuildForm(reqs);
    });

    effect(() => {
      if (this.disabled()) {
        this.form.disable({ emitEvent: false });
      } else {
        this.form.enable({ emitEvent: false });
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Visible fields (not hidden) */
  visibleFields(): FieldRequirement[] {
    const reqs = this.requirements();
    if (!reqs) return [];
    return reqs.fields.filter((f) => f.type !== 'hidden');
  }

  /** Hidden fields */
  hiddenFields(): FieldRequirement[] {
    const reqs = this.requirements();
    if (!reqs) return [];
    return reqs.fields.filter((f) => f.type === 'hidden');
  }

  /** Checks if a field has an error */
  isFieldInvalid(fieldName: string): boolean {
    const control = this.form.get(fieldName);
    return control ? control.invalid && control.touched : false;
  }

  private rebuildForm(requirements: FieldRequirements | null): void {
    this.destroy$.next();

    this.form.reset();

    const keys = Object.keys(this.form.controls);
    keys.forEach((key) => this.form.removeControl(key));

    if (!requirements) return;

    for (const field of requirements.fields) {
      let defaultValue = field.defaultValue ?? '';

      // Do not auto-fill returnUrl/cancelUrl from currentUrl
      // These URLs must come from StrategyContext (CheckoutComponent)
      // The form focuses on real user inputs (token, customerEmail, saveForFuture)
      if (
        field.autoComplete === 'current-url' &&
        (field.name === 'returnUrl' || field.name === 'cancelUrl')
      ) {
        // Keep empty - these URLs come from context, not from the form
        defaultValue = '';
      } else if (field.autoComplete === 'current-url') {
        defaultValue = typeof window !== 'undefined' ? window.location.href : '';
      }

      if (isDevMode() && field.name === 'token' && field.required && !defaultValue) {
        defaultValue = 'tok_visa1234567890abcdef';
      }

      let controlValue: string | boolean = defaultValue;
      if (field.name === 'saveForFuture') {
        if (defaultValue === 'false' || defaultValue === '' || !defaultValue) {
          controlValue = false;
        } else if (defaultValue === 'true') {
          controlValue = true;
        } else {
          controlValue = !!defaultValue;
        }
      }

      const isRequired =
        field.required && !(isDevMode() && field.type === 'hidden' && field.name === 'token');
      const validators = isRequired ? [Validators.required] : [];

      if (field.type === 'email') {
        validators.push(Validators.email);
      }

      this.form.addControl(
        field.name,
        new FormControl(controlValue, { validators, nonNullable: true }),
      );
    }

    this.emitFormState();

    this.form.valueChanges.pipe(debounceTime(150), takeUntil(this.destroy$)).subscribe(() => {
      this.emitFormState();
    });
  }

  private emitFormState(): void {
    const values = this.form.value;
    const options: PaymentOptions = {};

    if (typeof values['token'] === 'string' && values['token']) options.token = values['token'];
    if (typeof values['returnUrl'] === 'string' && values['returnUrl'])
      options.returnUrl = values['returnUrl'];
    if (typeof values['cancelUrl'] === 'string' && values['cancelUrl'])
      options.cancelUrl = values['cancelUrl'];
    if (typeof values['customerEmail'] === 'string' && values['customerEmail'])
      options.customerEmail = values['customerEmail'];

    if (typeof values['saveForFuture'] === 'boolean') {
      options.saveForFuture = values['saveForFuture'];
    } else if (typeof values['saveForFuture'] === 'string') {
      options.saveForFuture = values['saveForFuture'] === 'true';
    }

    this.formChange.emit(options);
    this.formValidChange.emit(this.form.valid);
  }

  /** Translates the method description */
  translateText(key?: string, params?: Record<string, string | number>): string {
    if (!key) return '';
    return this.i18n.t(key, params);
  }

  readonly fieldRequiredText = computed(() => this.i18n.t(I18nKeys.ui.field_required));
  readonly selectProviderMethodText = computed(() =>
    this.i18n.t(I18nKeys.ui.select_provider_method),
  );
  readonly methodNoAdditionalDataText = computed(() =>
    this.i18n.t(I18nKeys.ui.method_no_additional_data),
  );
}
