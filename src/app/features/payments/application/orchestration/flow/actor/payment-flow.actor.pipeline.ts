import type { PaymentFlowSnapshotSideEffects } from '@payments/application/orchestration/flow/actor/payment-flow.actor.side-effects';
import type { PaymentFlowSnapshotState } from '@payments/application/orchestration/flow/actor/payment-flow.actor.snapshot-state';
import type { PaymentFlowTelemetryReporter } from '@payments/application/orchestration/flow/actor/payment-flow.actor.telemetry-reporter';
import type { PaymentFlowSnapshot } from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';

/**
 * Coordinates snapshot updates, telemetry, and side effects in order.
 */
export class PaymentFlowSnapshotPipeline {
  constructor(
    private readonly snapshotState: PaymentFlowSnapshotState,
    private readonly setSnapshotSignal: (snapshot: PaymentFlowSnapshot) => void,
    private readonly telemetryReporter: PaymentFlowTelemetryReporter,
    private readonly sideEffects: PaymentFlowSnapshotSideEffects,
  ) {}

  handleSnapshot(snapshot: PaymentFlowSnapshot): void {
    const prevSnapshot = this.snapshotState.get();
    this.setSnapshotSignal(snapshot);
    this.telemetryReporter.recordSnapshot(snapshot, prevSnapshot);
    this.snapshotState.set(snapshot);
    this.sideEffects.handleSnapshot(snapshot);
  }
}
