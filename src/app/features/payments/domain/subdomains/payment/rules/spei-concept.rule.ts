/**
 * SPEI payment concept and reference rules (Mexican regulation).
 * Pure domain rules — no i18n, no throws.
 */

/** Max length for SPEI payment concept (Banco de México regulation). */
export const SPEI_CONCEPT_MAX_LENGTH = 40;

/**
 * Formats a valid payment concept for SPEI (max 40 characters).
 *
 * @param orderId Order identifier to include
 * @returns Sanitized concept string, truncated to max length
 */
export function formatSpeiPaymentConcept(orderId: string): string {
  const prefix = 'PAGO';
  const sanitizedOrderId = orderId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `${prefix} ${sanitizedOrderId}`.substring(0, SPEI_CONCEPT_MAX_LENGTH);
}

/** Length of SPEI numeric reference. */
export const SPEI_REFERENCE_LENGTH = 7;

/**
 * Generates a 7-digit numeric reference from an order ID.
 * Deterministic: same orderId always yields the same reference.
 *
 * @param orderId Order identifier
 * @returns 7-digit zero-padded string
 */
export function generateSpeiReference(orderId: string): string {
  const hash = orderId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return String(hash % Math.pow(10, SPEI_REFERENCE_LENGTH)).padStart(SPEI_REFERENCE_LENGTH, '0');
}
