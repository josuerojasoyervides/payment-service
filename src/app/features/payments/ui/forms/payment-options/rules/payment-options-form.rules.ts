import { disabled, email, required, type SchemaPath } from '@angular/forms/signals';
import type {
  FieldRequirement,
  FieldRequirements,
} from '@app/features/payments/application/api/contracts/checkout-field-requirements.types';
import type { PaymentOptions } from '@app/features/payments/domain/subdomains/payment/entities/payment-options.model';
import type {
  FlagFieldName,
  NormalizedFlagField,
  NormalizedRequirements,
  NormalizedTextField,
} from '@payments/ui/forms/payment-options/types/payment-options-form.types';
import {
  FLAG_FIELD_SET,
  type FlagModel,
  type PaymentOptionsFormModel,
  type TextModel,
} from '@payments/ui/forms/payment-options/types/payment-options-form.types';

export function isFlagField(field: FieldRequirement): boolean {
  return FLAG_FIELD_SET.has(field.name);
}

export function isEmailField(field: FieldRequirement): boolean {
  return field.type === 'email';
}

export function normalizeRequirements(reqs: FieldRequirements): NormalizedRequirements {
  const textFields: NormalizedTextField[] = [];
  const flagFields: NormalizedFlagField[] = [];

  for (const field of reqs.fields) {
    if (isFlagField(field)) {
      flagFields.push({
        name: field.name,
        required: field.required,
        requirement: field,
      });
      continue;
    }

    textFields.push({
      name: field.name,
      required: field.required,
      isEmail: field.type === 'email',
      requirement: field,
    });
  }

  return { textFields, flagFields };
}

export function buildInitialModel(normalized: NormalizedRequirements): PaymentOptionsFormModel {
  const values: TextModel = {};
  const flags: FlagModel = {};

  for (const f of normalized.textFields) {
    values[f.name] = resolveDefaultString(f.requirement);
  }

  for (const f of normalized.flagFields) {
    flags[f.name] = resolveDefaultBoolean(f.requirement);
  }

  return { values, flags };
}

export function writePaymentOptions(
  normalized: NormalizedRequirements,
  model: PaymentOptionsFormModel,
): PaymentOptions {
  const options: PaymentOptions = {};

  for (const f of normalized.textFields) {
    const trimmed = (model.values[f.name] ?? '').trim();
    if (!trimmed) continue;
    setDynamicOption(options, f.name, trimmed);
  }

  for (const f of normalized.flagFields) {
    const value = model.flags[f.name];
    if (value === undefined) continue;

    const writer = getFlagWriter(f.name as FlagFieldName);
    writer(options, value);
  }

  return options;
}

export function applyTextSchema(
  path: SchemaPath<string> | undefined,
  field: NormalizedTextField,
  isDisabled: () => boolean,
): void {
  if (!path) return;

  disabled(path, isDisabled);

  if (field.required) required(path);
  if (field.isEmail) email(path);
}

export function applyFlagSchema(
  path: SchemaPath<boolean> | undefined,
  field: NormalizedFlagField,
  isDisabled: () => boolean,
): void {
  if (!path) return;

  disabled(path, isDisabled);

  if (field.required) required(path);
}

export function shouldKeepCurrentUrlEmpty(field: FieldRequirement): boolean {
  return (
    field.autoComplete === 'current-url' &&
    (field.name === 'returnUrl' || field.name === 'cancelUrl')
  );
}

export function resolveDefaultString(field: FieldRequirement): string {
  if (shouldKeepCurrentUrlEmpty(field)) return '';

  if (field.autoComplete === 'current-url') {
    return typeof window !== 'undefined' ? window.location.href : '';
  }

  return field.defaultValue ?? '';
}

export function resolveDefaultBoolean(field: FieldRequirement): boolean {
  const raw = (field.defaultValue ?? '').trim().toLowerCase();
  if (!raw) return false;
  if (raw === 'false') return false;
  if (raw === 'true') return true;
  return Boolean(raw);
}

export function setDynamicOption(options: PaymentOptions, key: string, value: unknown): void {
  (options as Record<string, unknown>)[key] = value;
}

type FlagWriter = (options: PaymentOptions, value: boolean) => void;

const FLAG_WRITERS: Readonly<Record<FlagFieldName, FlagWriter>> = {
  saveForFuture: (options, value) => {
    (options as PaymentOptions).saveForFuture = value;
  },
};

function getFlagWriter(name: FlagFieldName): FlagWriter {
  return FLAG_WRITERS[name] ?? ((options, value) => setDynamicOption(options, name, value));
}
