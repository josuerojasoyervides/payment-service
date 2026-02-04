import type { PaymentFlowSnapshot } from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';

/**
 * Shared holder for the latest machine snapshot used by telemetry and inspection.
 */
export class PaymentFlowSnapshotState {
  private prevSnapshot: PaymentFlowSnapshot | null = null;

  get(): PaymentFlowSnapshot | null {
    return this.prevSnapshot;
  }

  set(snapshot: PaymentFlowSnapshot | null): void {
    this.prevSnapshot = snapshot;
  }
}
