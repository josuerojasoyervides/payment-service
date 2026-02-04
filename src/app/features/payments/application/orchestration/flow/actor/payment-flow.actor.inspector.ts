import type { LoggerService } from '@core/logging';
import type { PaymentFlowSnapshotState } from '@payments/application/orchestration/flow/actor/payment-flow.actor.snapshot-state';
import {
  redactFlowContext,
  redactIntent,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.actor.utils';
import type { PaymentFlowSnapshot } from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';
import {
  isPaymentFlowSnapshot,
  isSnapshotInspectionEventWithSnapshot,
} from '@payments/application/orchestration/flow/payment-flow/policy/payment-flow.guards';
import type { InspectionEvent } from 'xstate';

/**
 * Logs actor transitions with redaction for diagnostics.
 */
export class PaymentFlowActorInspector {
  constructor(
    private readonly logger: LoggerService,
    private readonly snapshotState: PaymentFlowSnapshotState,
  ) {}

  readonly inspect = (insp: InspectionEvent): void => {
    if (!isSnapshotInspectionEventWithSnapshot(insp, isPaymentFlowSnapshot)) return;

    const snap = insp.snapshot as PaymentFlowSnapshot;
    const prevSnapshot = this.snapshotState.get();
    const prevState = prevSnapshot?.value ?? null;
    const changed = prevSnapshot?.value !== snap.value;
    const tags = snap.tags ? Array.from(snap.tags) : undefined;

    this.logger.info(
      'PaymentFlowMachine transition',
      'PaymentFlowActorService',
      {
        event: insp.event,
        state: snap.value,
        prevState,
        changed,
        ...(tags && { tags }),
        context: {
          ...snap.context,
          flowContext: redactFlowContext(snap.context.flowContext),
          intent: redactIntent(snap.context.intent),
        },
      },
      this.logger.getCorrelationId(),
    );

    this.snapshotState.set(snap);
  };
}
