import { MockProviderHealthAdapter } from '@app/features/payments/infrastructure/health/mock-provider-health.adapter';

describe('MockProviderHealthAdapter', () => {
  it('returns healthy status for stripe with latency', async () => {
    vi.useFakeTimers();
    const adapter = new MockProviderHealthAdapter();
    const promise = adapter.check('stripe');
    vi.advanceTimersByTime(300);
    const result = await promise;
    expect(result.status).toBe('healthy');
    expect(result.latencyMs).toBeGreaterThan(0);
    vi.useRealTimers();
  });
});
