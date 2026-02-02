export interface RedirectReturnRaw {
  /**
   * Raw query params from redirect return.
   *
   * Canonical rule: when flattening repeated keys, "last wins".
   * Normalizers must handle string | string[].
   */
  query: Record<string, string | string[]>;
}
