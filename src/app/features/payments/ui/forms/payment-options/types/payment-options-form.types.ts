import type { FieldTree, SchemaPath, SchemaPathTree } from '@angular/forms/signals';
import type { FieldRequirement } from '@app/features/payments/domain/common/entities/field-requirement.model';

export type TextModel = Record<string, string>;
export type FlagModel = Record<string, boolean>;

export interface PaymentOptionsFormModel {
  values: TextModel;
  flags: FlagModel;
}

export type DynamicTextPathTree = SchemaPathTree<TextModel> & Record<string, SchemaPath<string>>;
export type DynamicFlagPathTree = SchemaPathTree<FlagModel> & Record<string, SchemaPath<boolean>>;

export type RootPathTree = SchemaPathTree<PaymentOptionsFormModel> & {
  values: DynamicTextPathTree;
  flags: DynamicFlagPathTree;
};

export type DynamicTextFieldTree = FieldTree<TextModel> & Record<string, FieldTree<string>>;
export type DynamicFlagFieldTree = FieldTree<FlagModel> & Record<string, FieldTree<boolean>>;

export type RootFieldTree = FieldTree<PaymentOptionsFormModel> & {
  values: DynamicTextFieldTree;
  flags: DynamicFlagFieldTree;
};

export const FLAG_FIELD_NAMES = ['saveForFuture'] as const;
export type FlagFieldName = (typeof FLAG_FIELD_NAMES)[number];

export const FLAG_FIELD_SET: ReadonlySet<string> = new Set<string>(FLAG_FIELD_NAMES);

export interface NormalizedTextField {
  readonly name: string;
  readonly required: boolean;
  readonly isEmail: boolean;
  readonly requirement: FieldRequirement;
}

export interface NormalizedFlagField {
  readonly name: string;
  readonly required: boolean;
  readonly requirement: FieldRequirement;
}

export interface NormalizedRequirements {
  readonly textFields: readonly NormalizedTextField[];
  readonly flagFields: readonly NormalizedFlagField[];
}
