export type FakeScenario =
  | 'provider_error'
  | 'decline'
  | 'insufficient'
  | 'expired'
  | 'timeout'
  | 'circuit_open'
  | 'rate_limited';
