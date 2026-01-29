import type { PipeTransform } from '@angular/core';
import { Pipe } from '@angular/core';

/**
 * Pipe to format CLABE (Clave Bancaria Estandarizada) with spaces.
 *
 * Formats an 18-digit CLABE in the format: XXX XXX XXXXXXXXXXX X
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
   * Formats CLABE with spaces for better readability.
   *
   * @param value 18-digit CLABE (string or number)
   * @returns Formatted CLABE with spaces: XXX XXX XXXXXXXXXXX X
   */
  transform(value: string | number | null | undefined): string {
    if (value == null) {
      return '';
    }

    const clabe = String(value).replace(/\s/g, '');

    if (clabe.length !== 18) {
      return clabe;
    }

    if (!/^\d+$/.test(clabe)) {
      return clabe;
    }

    // Format: XXX XXX XXXXXXXXXXX X
    // Group 1: 3 digits (bank code)
    // Group 2: 3 digits (plaza)
    // Group 3: 11 digits (account)
    // Group 4: 1 digit (check digit)
    return clabe.replace(/(\d{3})(\d{3})(\d{11})(\d{1})/, '$1 $2 $3 $4');
  }
}
