import type { InspectionEvent } from 'xstate';

import { hasIntentPolicy, isFinalIntentPolicy, needsUserActionPolicy } from './payment-flow.policy';
import type { PaymentFlowMachineContext, PaymentFlowSnapshot } from './payment-flow.types';
/**
 * "@xstate.snapshot" event with snapshot typed as TSnap.
 */
export type SnapshotInspectionEvent<TSnap> = Extract<
  InspectionEvent,
  { type: '@xstate.snapshot' }
> & { snapshot: TSnap };

export function isMachineSnapshotLike(
  snapshot: unknown,
): snapshot is { value: unknown; context: unknown } {
  return !!snapshot && typeof snapshot === 'object' && 'value' in snapshot && 'context' in snapshot;
}

/**
 * Generic guard: if the event is '@xstate.snapshot' and the snapshot passes validation,
 * TS knows snapshot is TSnap.
 */
export function isSnapshotInspectionEventWithSnapshot<TSnap>(
  ev: InspectionEvent,
  isSnap: (s: unknown) => s is TSnap,
): ev is SnapshotInspectionEvent<TSnap> {
  if (ev.type !== '@xstate.snapshot') return false;
  if (!('snapshot' in ev)) return false;

  const snapshot = (ev as { snapshot: unknown }).snapshot;
  return isSnap(snapshot);
}

/**
 * Validator specific to this machine.
 */
export function isPaymentFlowSnapshot(s: unknown): s is PaymentFlowSnapshot {
  return isMachineSnapshotLike(s);
}

export const paymentFlowGuards = {
  hasIntent: ({ context }: { context: PaymentFlowMachineContext }) => hasIntentPolicy(context),

  needsUserAction: ({ context }: { context: PaymentFlowMachineContext }) =>
    needsUserActionPolicy(context),

  isFinal: ({ context }: { context: PaymentFlowMachineContext }) => isFinalIntentPolicy(context),
};
