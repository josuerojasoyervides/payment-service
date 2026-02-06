import type { KeyValueStorage } from '@payments/application/api/contracts/key-value-storage.contract';
import { buildInitialMachineContext } from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.actor.utils';
import type {
  PaymentFlowMachineContext,
  PaymentFlowSnapshot,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';
import { FlowContextStore } from '@payments/application/orchestration/flow/payment-flow/persistence/payment-flow.persistence';

/**
 * Persists/rehydrates flow context for resume and cleanup.
 */
export class PaymentFlowContextPersistence {
  private readonly flowContextStore: FlowContextStore;

  constructor(storage: KeyValueStorage) {
    this.flowContextStore = new FlowContextStore(storage);
  }

  buildInitialContext(): Partial<PaymentFlowMachineContext> | undefined {
    return buildInitialMachineContext(this.flowContextStore);
  }

  handleSnapshot(snapshot: PaymentFlowSnapshot): void {
    if (snapshot.hasTag('done') || snapshot.hasTag('failed')) {
      this.flowContextStore.clear();
      return;
    }

    const flowContext = snapshot.context.flowContext;
    if (!flowContext) return;

    this.flowContextStore.save(flowContext);
  }

  clear(): void {
    this.flowContextStore.clear();
  }
}
