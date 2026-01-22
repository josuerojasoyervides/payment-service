export function getIdempotencyHeaders(
  key: string,
  operation: string,
  idempotencyKey?: string,
): Record<string, string> {
  const finalKey = idempotencyKey ?? `${key}-${operation}-${Date.now()}`;
  return {
    'Idempotency-Key': finalKey,
  };
}
