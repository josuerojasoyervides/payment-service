import type { InspectionEvent } from 'xstate';

import { isFinalStatus, needsUserAction } from './payment-flow.helpers';
import type { PaymentFlowMachineContext, PaymentFlowSnapshot } from './payment-flow.types';
/**
 * Evento "@xstate.snapshot" pero con snapshot tipado a TSnap.
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
 * Guard genérico: si el evento es '@xstate.snapshot' y su snapshot pasa el validator,
 * TS sabe que snapshot es TSnap.
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
 * Validator específico para tu máquina.
 */
export function isPaymentFlowSnapshot(s: unknown): s is PaymentFlowSnapshot {
  return isMachineSnapshotLike(s);
}

export const paymentFlowGuards = {
  hasIntent: ({ context }: { context: PaymentFlowMachineContext }) => !!context.intent,

  needsUserAction: ({ context }: { context: PaymentFlowMachineContext }) =>
    needsUserAction(context.intent),

  isFinal: ({ context }: { context: PaymentFlowMachineContext }) =>
    isFinalStatus(context.intent?.status),
};
