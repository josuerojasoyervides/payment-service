import {
  computed,
  effect,
  inject,
  Injectable,
  Injector,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import { disabled, email, type FieldTree, form, required } from '@angular/forms/signals';
import type { FieldRequirements } from '@app/features/payments/domain/common/entities/field-requirement.model';
import type { PaymentOptions } from '@app/features/payments/domain/subdomains/payment/entities/payment-options.model';
import {
  isEmailField,
  isFlagField,
  resolveDefaultBoolean,
  resolveDefaultString,
  setDynamicOption,
} from '@app/features/payments/ui/forms/payment-options/rules/payment-options-form.rules';
import type {
  FlagModel,
  PaymentOptionsFormModel,
  RootFieldTree,
  RootPathTree,
  TextModel,
} from '@app/features/payments/ui/forms/payment-options/types/payment-options-form.types';

@Injectable()
export class PaymentOptionsForm {
  private readonly injector: Injector = inject(Injector);

  private readonly requirementsSig = signal<FieldRequirements | null>(null);
  private readonly disabledSig = signal(false);

  private readonly modelSig = signal<PaymentOptionsFormModel>({ values: {}, flags: {} });

  private readonly treeSig = signal<RootFieldTree>(this.buildTree());

  readonly requirements = this.requirementsSig.asReadonly();
  readonly model = this.modelSig.asReadonly();
  readonly tree = this.treeSig.asReadonly();

  readonly isValid = computed(() => this.treeSig()().valid());

  readonly paymentOptions = computed<PaymentOptions>(() => {
    const reqs = this.requirementsSig();
    const model = this.modelSig();

    const options: PaymentOptions = {};
    if (!reqs) return options;

    for (const field of reqs.fields) {
      if (isFlagField(field)) {
        const flagValue = model.flags[field.name];
        if (typeof flagValue === 'boolean') {
          if (field.name === 'saveForFuture') setDynamicOption(options, 'saveForFuture', flagValue);
          else setDynamicOption(options, field.name, flagValue);
        }
        continue;
      }

      const trimmed = (model.values[field.name] ?? '').trim();
      if (!trimmed) continue;

      setDynamicOption(options, field.name, trimmed);
    }

    return options;
  });

  constructor() {
    effect(() => {
      const reqs = this.requirementsSig();
      untracked(() => this.rebuild(reqs));
    });
  }

  setRequirements(reqs: FieldRequirements | null): void {
    this.requirementsSig.set(reqs);
  }

  setDisabled(isDisabled: boolean): void {
    this.disabledSig.set(isDisabled);
  }

  textField(name: string): FieldTree<string> | null {
    return this.treeSig().values[name] ?? null;
  }

  flagField(name: string): FieldTree<boolean> | null {
    return this.treeSig().flags[name] ?? null;
  }

  private rebuild(reqs: FieldRequirements | null): void {
    if (!reqs) {
      this.modelSig.set({ values: {}, flags: {} });
      this.treeSig.set(this.buildTree());
      return;
    }

    const values: TextModel = {};
    const flags: FlagModel = {};

    for (const field of reqs.fields) {
      if (isFlagField(field)) flags[field.name] = resolveDefaultBoolean(field);
      else values[field.name] = resolveDefaultString(field);
    }

    this.modelSig.set({ values, flags });

    this.treeSig.set(
      this.buildTree((schemaPath) => {
        const root = schemaPath as unknown as RootPathTree;

        for (const field of reqs.fields) {
          if (isFlagField(field)) {
            const path = root.flags[field.name];
            if (!path) continue;

            disabled(path, () => this.disabledSig());
            if (field.required) required(path);
            continue;
          }

          const path = root.values[field.name];
          if (!path) continue;

          disabled(path, () => this.disabledSig());
          if (field.required) required(path);
          if (isEmailField(field)) email(path);
        }
      }),
    );
  }

  private buildTree(
    buildSchema?: Parameters<typeof form<PaymentOptionsFormModel>>[1],
  ): RootFieldTree {
    return runInInjectionContext(this.injector, () => {
      const tree = buildSchema ? form(this.modelSig, buildSchema) : form(this.modelSig);
      return tree as unknown as RootFieldTree;
    });
  }
}
