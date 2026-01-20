import { en } from './translations/en';

/**
 * Construye un árbol de claves de traducción a partir del objeto de traducciones
 * base (en). Cada hoja contiene la ruta completa con puntos, ej: 'errors.card_declined'.
 */
function buildKeys(obj: Record<string, any>, prefix = ''): any {
    return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => {
            const path = prefix ? `${prefix}.${key}` : key;
            if (value && typeof value === 'object') {
                return [key, buildKeys(value as Record<string, any>, path)];
            }
            return [key, path];
        }),
    );
}

export const I18nKeys = buildKeys(en);

/**
 * Tipo que representa cualquier clave de traducción válida derivada de I18nKeys.
 */
export type I18nKey =
    (typeof I18nKeys)['errors'][keyof (typeof I18nKeys)['errors']] |
    (typeof I18nKeys)['messages'][keyof (typeof I18nKeys)['messages']] |
    (typeof I18nKeys)['ui'][keyof (typeof I18nKeys)['ui']];

