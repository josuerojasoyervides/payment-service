import { Component, input, output, effect, OnDestroy, isDevMode, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil, debounceTime } from 'rxjs';
import { PaymentOptions } from '../../shared';
import { FieldRequirements, FieldConfig } from '../../../domain/ports';
import { I18nService, I18nKeys } from '@core/i18n';

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
    readonly form = new FormGroup<Record<string, FormControl>>({});
    
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
    visibleFields(): FieldConfig[] {
        const reqs = this.requirements();
        if (!reqs) return [];
        return reqs.fields.filter(f => f.type !== 'hidden');
    }

    /** Hidden fields */
    hiddenFields(): FieldConfig[] {
        const reqs = this.requirements();
        if (!reqs) return [];
        return reqs.fields.filter(f => f.type === 'hidden');
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
        keys.forEach(key => {
            (this.form as any).removeControl(key);
        });

        if (!requirements) return;

        for (const field of requirements.fields) {
            let defaultValue = field.defaultValue ?? '';

            // No auto-fill returnUrl/cancelUrl con currentUrl
            // Estas URLs deben venir de StrategyContext (CheckoutComponent)
            // El formulario se enfoca en inputs reales del usuario (token, customerEmail, saveForFuture)
            if (field.autoFill === 'currentUrl' && (field.name === 'returnUrl' || field.name === 'cancelUrl')) {
                // Dejar vacío - estas URLs vienen del context, no del formulario
                defaultValue = '';
            } else if (field.autoFill === 'currentUrl') {
                defaultValue = typeof window !== 'undefined' ? window.location.href : '';
            }

            if (isDevMode() && field.name === 'token' && field.required && !defaultValue) {
                defaultValue = 'tok_visa1234567890abcdef';
            }

            let controlValue: any = defaultValue;
            if (field.name === 'saveForFuture') {
                if (defaultValue === 'false' || defaultValue === '' || !defaultValue) {
                    controlValue = false;
                } else if (defaultValue === 'true') {
                    controlValue = true;
                } else {
                    controlValue = !!defaultValue;
                }
            }

            const isRequired = field.required && !(isDevMode() && field.type === 'hidden' && field.name === 'token');
            const validators = isRequired ? [Validators.required] : [];
            
            if (field.type === 'email') {
                validators.push(Validators.email);
            }

            this.form.addControl(
                field.name,
                new FormControl(controlValue, { validators, nonNullable: true })
            );
        }

        this.emitFormState();

        this.form.valueChanges
            .pipe(
                debounceTime(150),
                takeUntil(this.destroy$)
            )
            .subscribe(() => {
                this.emitFormState();
            });
    }

    private emitFormState(): void {
        const values = this.form.value;
        const options: PaymentOptions = {};

        if (values['token']) options.token = values['token'];
        if (values['returnUrl']) options.returnUrl = values['returnUrl'];
        if (values['cancelUrl']) options.cancelUrl = values['cancelUrl'];
        if (values['customerEmail']) options.customerEmail = values['customerEmail'];
        
        if (values['saveForFuture'] !== undefined && values['saveForFuture'] !== null) {
            if (typeof values['saveForFuture'] === 'boolean') {
                options.saveForFuture = values['saveForFuture'];
            } else if (typeof values['saveForFuture'] === 'string') {
                options.saveForFuture = values['saveForFuture'] === 'true';
            } else {
                options.saveForFuture = !!values['saveForFuture'];
            }
        }

        this.formChange.emit(options);
        this.formValidChange.emit(this.form.valid);
    }

    /** Translates a field label using i18n if needed */
    translateFieldLabel(field: FieldConfig): string {
        const labelMap: Record<string, string> = {
            'Token de tarjeta': I18nKeys.ui.card_token,
            'Guardar tarjeta para futuras compras': I18nKeys.ui.save_card_future,
            'Correo electrónico': I18nKeys.ui.email_label,
        };

        const translationKey = labelMap[field.label];
        if (translationKey) {
            return this.i18n.t(translationKey);
        }
        return field.label;
    }

    /** Translates the method description */
    translateDescription(description: string | undefined): string {
        if (!description) return '';
        const descMap: Record<string, string> = {
            'Pago con tarjeta de crédito o débito': I18nKeys.ui.card_payment_description,
            'Transferencia bancaria SPEI': I18nKeys.ui.spei_bank_transfer,
        };
        const translationKey = descMap[description];
        if (translationKey) {
            return this.i18n.t(translationKey);
        }
        return description;
    }

    /** Translates the instructions */
    translateInstructions(instructions: string | undefined): string {
        if (!instructions) return '';
        const instMap: Record<string, string> = {
            'Ingresa los datos de tu tarjeta de forma segura': I18nKeys.ui.enter_card_data,
            'Recibirás instrucciones de pago en tu correo electrónico': I18nKeys.ui.spei_email_instructions,
        };
        const translationKey = instMap[instructions];
        if (translationKey) {
            return this.i18n.t(translationKey);
        }
        return instructions;
    }

    get fieldRequiredText(): string {
        return this.i18n.t(I18nKeys.ui.field_required);
    }

    get selectProviderMethodText(): string {
        return this.i18n.t(I18nKeys.ui.select_provider_method);
    }

    get methodNoAdditionalDataText(): string {
        return this.i18n.t(I18nKeys.ui.method_no_additional_data);
    }
}
