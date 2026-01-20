import { Component, input, output, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil, debounceTime } from 'rxjs';
import { PaymentOptions } from '../../shared';
import { FieldRequirements, FieldConfig } from '../../../domain/ports';

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
    template: `
        <div class="space-y-4">
            @if (requirements(); as reqs) {
                @if (reqs.description) {
                    <p class="text-sm text-gray-600">{{ reqs.description }}</p>
                }
                
                @if (reqs.instructions) {
                    <div class="alert-info flex items-start gap-2">
                        <span class="text-lg">💡</span>
                        <span class="text-sm">{{ reqs.instructions }}</span>
                    </div>
                }

                <form [formGroup]="form" class="space-y-4">
                    @for (field of visibleFields(); track field.name) {
                        <div class="space-y-1">
                            <label [for]="field.name" class="label">
                                {{ field.label }}
                                @if (field.required) {
                                    <span class="text-red-500 ml-0.5">*</span>
                                }
                            </label>
                            
                            <input
                                [id]="field.name"
                                [type]="field.type"
                                [formControlName]="field.name"
                                [placeholder]="field.placeholder ?? ''"
                                class="input"
                                [class.input-error]="isFieldInvalid(field.name)"
                            />
                            
                            @if (isFieldInvalid(field.name)) {
                                <p class="text-sm text-red-500">
                                    Este campo es requerido
                                </p>
                            }
                        </div>
                    }

                    @if (hiddenFields().length > 0) {
                        <div class="text-xs text-gray-400 space-y-1">
                            @for (field of hiddenFields(); track field.name) {
                                <div class="flex items-center gap-2">
                                    <span>{{ field.label }}:</span>
                                    <code class="bg-gray-100 px-1 rounded">
                                        {{ form.get(field.name)?.value || '(auto)' }}
                                    </code>
                                </div>
                            }
                        </div>
                    }
                </form>

                @if (reqs.fields.length === 0) {
                    <p class="text-sm text-gray-500 italic">
                        Este método no requiere datos adicionales.
                    </p>
                }
            } @else {
                <p class="text-sm text-gray-500 italic">
                    Selecciona un proveedor y método de pago.
                </p>
            }
        </div>
    `,
})
export class PaymentFormComponent implements OnDestroy {
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

            const validators = field.required ? [Validators.required] : [];
            
            if (field.type === 'email') {
                validators.push(Validators.email);
            }

            this.form.addControl(
                field.name,
                new FormControl(defaultValue, { validators, nonNullable: true })
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
        if (values['saveForFuture']) options.saveForFuture = values['saveForFuture'] === 'true';

        this.formChange.emit(options);
        this.formValidChange.emit(this.form.valid);
    }
}
