import { Component, input, output, effect, OnDestroy, isDevMode, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil, debounceTime } from 'rxjs';
import { PaymentOptions } from '../../shared';
import { FieldRequirements, FieldConfig } from '../../../domain/ports';
import { I18nService, I18nKeys } from '@core/i18n';

/**
 * Componente de formulario de pago dinámico.
 * 
 * Genera campos automáticamente basándose en los requisitos
 * del proveedor y método de pago seleccionados.
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
    
    /** Requisitos de campos del formulario */
    readonly requirements = input<FieldRequirements | null>(null);
    
    /** Si el formulario está deshabilitado */
    readonly disabled = input<boolean>(false);
    
    /** Emite cuando cambian los valores del formulario */
    readonly formChange = output<PaymentOptions>();
    
    /** Emite cuando cambia la validez del formulario */
    readonly formValidChange = output<boolean>();

    /** Formulario reactivo */
    readonly form = new FormGroup<Record<string, FormControl>>({});
    
    private readonly destroy$ = new Subject<void>();

    constructor() {
        // Efecto para reconstruir el formulario cuando cambian los requisitos
        effect(() => {
            const reqs = this.requirements();
            this.rebuildForm(reqs);
        });

        // Efecto para deshabilitar/habilitar el formulario
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

    /** Campos visibles (no hidden) */
    visibleFields(): FieldConfig[] {
        const reqs = this.requirements();
        if (!reqs) return [];
        return reqs.fields.filter(f => f.type !== 'hidden');
    }

    /** Campos ocultos */
    hiddenFields(): FieldConfig[] {
        const reqs = this.requirements();
        if (!reqs) return [];
        return reqs.fields.filter(f => f.type === 'hidden');
    }

    /** Verifica si un campo tiene error */
    isFieldInvalid(fieldName: string): boolean {
        const control = this.form.get(fieldName);
        return control ? control.invalid && control.touched : false;
    }

    private rebuildForm(requirements: FieldRequirements | null): void {
        // Limpiar suscripciones anteriores
        this.destroy$.next();

        // Limpiar controles existentes usando reset y luego agregar nuevos
        this.form.reset();
        
        // Remover todos los controles manualmente
        const keys = Object.keys(this.form.controls);
        keys.forEach(key => {
            (this.form as any).removeControl(key);
        });

        if (!requirements) return;

        // Agregar controles según requisitos
        for (const field of requirements.fields) {
            let defaultValue = field.defaultValue ?? '';

            // Auto-fill para campos especiales
            if (field.autoFill === 'currentUrl') {
                defaultValue = typeof window !== 'undefined' ? window.location.href : '';
            }

            // En modo desarrollo, auto-rellenar token si es requerido y está vacío
            // El token debe cumplir el formato de Stripe: tok_ seguido de al menos 14 caracteres alfanuméricos (sin guiones bajos)
            if (isDevMode() && field.name === 'token' && field.required && !defaultValue) {
                defaultValue = 'tok_visa1234567890abcdef';
            }

            // Para saveForFuture, usar boolean false como default
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

            // Validadores: campos requeridos necesitan Validators.required
            // En modo desarrollo, el token hidden se auto-rellena, así que no necesita ser requerido en el form
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

        // Emitir cambios iniciales
        this.emitFormState();

        // Suscribirse a cambios del formulario
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

        // Mapear valores del formulario a PaymentOptions
        if (values['token']) options.token = values['token'];
        if (values['returnUrl']) options.returnUrl = values['returnUrl'];
        if (values['cancelUrl']) options.cancelUrl = values['cancelUrl'];
        if (values['customerEmail']) options.customerEmail = values['customerEmail'];
        
        // Manejar saveForFuture: puede venir como boolean (checkbox) o string 'true'/'false'
        if (values['saveForFuture'] !== undefined && values['saveForFuture'] !== null) {
            if (typeof values['saveForFuture'] === 'boolean') {
                options.saveForFuture = values['saveForFuture'];
            } else if (typeof values['saveForFuture'] === 'string') {
                options.saveForFuture = values['saveForFuture'] === 'true';
            } else {
                // Para checkbox, puede venir como true/false directamente
                options.saveForFuture = !!values['saveForFuture'];
            }
        }

        this.formChange.emit(options);
        this.formValidChange.emit(this.form.valid);
    }

    /** Traduce un label de campo usando i18n si es necesario */
    translateFieldLabel(field: FieldConfig): string {
        // Mapeo de labels conocidos a claves de traducción
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

    /** Traduce la descripción del método */
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

    /** Traduce las instrucciones */
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
