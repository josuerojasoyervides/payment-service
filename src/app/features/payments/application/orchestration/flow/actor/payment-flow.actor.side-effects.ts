import type { PaymentFlowFallbackBridge } from '@payments/application/orchestration/flow/actor/payment-flow.actor.fallback-bridge';
import type { PaymentFlowContextPersistence } from '@payments/application/orchestration/flow/actor/payment-flow.actor.persistence';
import type { PaymentFlowSnapshot } from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';

/**
 * Executes ordered snapshot side effects (persistence, fallback, etc.).
 */
export class PaymentFlowSnapshotSideEffects {
  constructor(
    private readonly persistence: PaymentFlowContextPersistence,
    private readonly fallbackBridge: PaymentFlowFallbackBridge,
  ) {}

  handleSnapshot(snapshot: PaymentFlowSnapshot): void {
    this.persistence.handleSnapshot(snapshot);
    this.fallbackBridge.handleSnapshot(snapshot);
  }
}
