/**
 * Generates a unique ID to simulate provider IDs.
 * Uses counter for determinism (still unique per call).
 */
let idCounter = 0;
export function generateId(prefix: string): string {
  idCounter++;
  const timestamp = Date.now().toString(36);
  const counterStr = idCounter.toString(36).padStart(6, '0');
  return `${prefix}_fake_${timestamp}${counterStr}`;
}
