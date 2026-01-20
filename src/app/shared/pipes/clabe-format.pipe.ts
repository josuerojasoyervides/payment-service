import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pipe para formatear CLABE (Clave Bancaria Estandarizada) con espacios.
 * 
 * Formatea una CLABE de 18 dígitos en el formato: XXX XXX XXXXXXXXXXX X
 * 
 * @example
 * ```html
 * <p>{{ '646180157000000001' | clabeFormat }}</p>
 * <!-- Output: 646 180 15700000000 1 -->
 * ```
 */
@Pipe({
    name: 'clabeFormat',
    standalone: true,
})
export class ClabeFormatPipe implements PipeTransform {
    /**
     * Formatea la CLABE con espacios para mejor legibilidad.
     * 
     * @param value CLABE de 18 dígitos (string o number)
     * @returns CLABE formateada con espacios: XXX XXX XXXXXXXXXXX X
     */
    transform(value: string | number | null | undefined): string {
        if (value == null) {
            return '';
        }

        // Convertir a string y eliminar espacios existentes
        let clabe = String(value).replace(/\s/g, '');

        // Validar que tenga 18 dígitos
        if (clabe.length !== 18) {
            // Si no tiene 18 dígitos, retornar sin formatear
            return clabe;
        }

        // Validar que solo contenga dígitos
        if (!/^\d+$/.test(clabe)) {
            return clabe;
        }

        // Formato: XXX XXX XXXXXXXXXXX X
        // Grupo 1: 3 dígitos (código de banco)
        // Grupo 2: 3 dígitos (plaza)
        // Grupo 3: 11 dígitos (cuenta)
        // Grupo 4: 1 dígito (dígito verificador)
        return clabe.replace(/(\d{3})(\d{3})(\d{11})(\d{1})/, '$1 $2 $3 $4');
    }
}
