import { en } from '@core/i18n/translations/en';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

type KeyTree<T> = {
  [K in keyof T]: T[K] extends object ? KeyTree<T[K]> : string;
};

function buildKeys<T extends object>(obj: T, prefix = ''): KeyTree<T> {
  const result = {} as KeyTree<T>;

  for (const key of Object.keys(obj) as (keyof T & string)[]) {
    const value = (obj as Record<string, unknown>)[key];
    const path = prefix ? `${prefix}.${key}` : key;

    if (isRecord(value)) {
      (result as Record<string, unknown>)[key] = buildKeys(value, path);
    } else {
      (result as Record<string, unknown>)[key] = path;
    }
  }

  return result;
}

export const I18nKeys = buildKeys(en);

type LeafValues<T> = T extends string
  ? T
  : T extends Record<string, unknown>
    ? { [K in keyof T]: LeafValues<T[K]> }[keyof T]
    : never;

export type I18nKey = LeafValues<typeof I18nKeys>;
