import type { Signal } from '@angular/core';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { FLOW_CONTEXT_STORAGE } from '@app/features/payments/application/api/tokens/flow/flow-context-storage.token';
import { FLOW_TELEMETRY_SINK } from '@app/features/payments/application/api/tokens/telemetry/flow-telemetry-sink.token';
import { FallbackOrchestratorService } from '@app/features/payments/application/orchestration/services/fallback/fallback-orchestrator.service';
import { NextActionOrchestratorService } from '@app/features/payments/application/orchestration/services/next-action/next-action-orchestrator.service';
import { CancelPaymentUseCase } from '@app/features/payments/application/orchestration/use-cases/intent/cancel-payment.use-case';
import { ConfirmPaymentUseCase } from '@app/features/payments/application/orchestration/use-cases/intent/confirm-payment.use-case';
import { GetPaymentStatusUseCase } from '@app/features/payments/application/orchestration/use-cases/intent/get-payment-status.use-case';
import { StartPaymentUseCase } from '@app/features/payments/application/orchestration/use-cases/intent/start-payment.use-case';
import { LoggerService } from '@core/logging';
import { deepComputed } from '@ngrx/signals';
import { PaymentFlowFallbackBridge } from '@payments/application/orchestration/flow/actor/payment-flow.actor.fallback-bridge';
import { PaymentFlowActorInspector } from '@payments/application/orchestration/flow/actor/payment-flow.actor.inspector';
import { PaymentFlowContextPersistence } from '@payments/application/orchestration/flow/actor/payment-flow.actor.persistence';
import { PaymentFlowSnapshotPipeline } from '@payments/application/orchestration/flow/actor/payment-flow.actor.pipeline';
import { PaymentFlowSnapshotSideEffects } from '@payments/application/orchestration/flow/actor/payment-flow.actor.side-effects';
import { PaymentFlowSnapshotState } from '@payments/application/orchestration/flow/actor/payment-flow.actor.snapshot-state';
import { PaymentFlowTelemetryReporter } from '@payments/application/orchestration/flow/actor/payment-flow.actor.telemetry-reporter';
import { createPaymentFlowMachine } from '@payments/application/orchestration/flow/payment-flow.machine';
import type {
  PaymentFlowActorRef,
  PaymentFlowCommandEvent,
  PaymentFlowEvent,
  PaymentFlowMachine,
  PaymentFlowMachineContext,
  PaymentFlowSnapshot,
  PaymentFlowSystemEvent,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';
import {
  PAYMENT_FLOW_CONFIG_OVERRIDES,
  PAYMENT_FLOW_INITIAL_CONTEXT,
} from '@payments/application/orchestration/flow/payment-flow/payment-flow-config.token';
import { firstValueFrom } from 'rxjs';
import { createActor } from 'xstate';

/**
 * Thin host for the payment flow actor and its collaborators.
 */
@Injectable()
export class PaymentFlowActorService {
  private readonly start = inject(StartPaymentUseCase);
  private readonly confirm = inject(ConfirmPaymentUseCase);
  private readonly cancel = inject(CancelPaymentUseCase);
  private readonly status = inject(GetPaymentStatusUseCase);
  private readonly fallbackOrchestrator = inject(FallbackOrchestratorService);
  private readonly nextActionOrchestrator = inject(NextActionOrchestratorService);
  private readonly logger = inject(LoggerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly telemetry = inject(FLOW_TELEMETRY_SINK);
  private readonly configOverrides = inject(PAYMENT_FLOW_CONFIG_OVERRIDES, { optional: true });
  private readonly initialContextOverride = inject(PAYMENT_FLOW_INITIAL_CONTEXT, {
    optional: true,
  });

  private readonly flowContextStorage = inject(FLOW_CONTEXT_STORAGE);
  private readonly contextPersistence = new PaymentFlowContextPersistence(this.flowContextStorage);
  private readonly initialContext: Partial<PaymentFlowMachineContext> = {
    ...(this.contextPersistence.buildInitialContext() ?? {}),
    ...this.initialContextOverride,
  };

  private readonly machine: PaymentFlowMachine = createPaymentFlowMachine(
    {
      startPayment: async (providerId, request, flowContext) =>
        firstValueFrom(this.start.execute(request, providerId, flowContext)),
      confirmPayment: async (providerId, request) =>
        firstValueFrom(this.confirm.execute(request, providerId)),
      cancelPayment: async (providerId, request) =>
        firstValueFrom(this.cancel.execute(request, providerId)),
      getStatus: async (providerId, request) =>
        firstValueFrom(this.status.execute(request, providerId)),
      clientConfirm: async (request) =>
        firstValueFrom(
          this.nextActionOrchestrator.requestClientConfirm(request.action, request.context),
        ),
      finalize: async (request) =>
        firstValueFrom(this.nextActionOrchestrator.requestFinalize(request.context)),
    },
    this.configOverrides ?? {},
    this.initialContext,
  );

  private readonly snapshotState = new PaymentFlowSnapshotState();
  private readonly inspector = new PaymentFlowActorInspector(this.logger, this.snapshotState);

  private readonly actor: PaymentFlowActorRef = createActor(this.machine, {
    inspect: this.inspector.inspect,
  });

  private _snapshot = signal(this.actor.getSnapshot() as PaymentFlowSnapshot);
  readonly snapshot: Signal<PaymentFlowSnapshot> = this._snapshot.asReadonly();
  readonly lastSentEvent = signal<PaymentFlowEvent | null>(null);

  private readonly telemetryReporter = new PaymentFlowTelemetryReporter(this.telemetry);
  private readonly fallbackBridge = new PaymentFlowFallbackBridge(
    this.fallbackOrchestrator,
    (event) => this.sendSystem(event),
  );
  private readonly sideEffects = new PaymentFlowSnapshotSideEffects(
    this.contextPersistence,
    this.fallbackBridge,
  );
  private readonly snapshotPipeline = new PaymentFlowSnapshotPipeline(
    this.snapshotState,
    (snapshot) => this._snapshot.set(snapshot),
    this.telemetryReporter,
    this.sideEffects,
  );

  readonly actorStatuses = deepComputed(() => ({
    isIdle: this.snapshot().hasTag('idle'),
    isLoading: this.snapshot().hasTag('loading'),
    isReady: this.snapshot().hasTag('ready'),
    hasError: this.snapshot().hasTag('error'),
  }));

  constructor() {
    this.startActor();
    this.subscribeToSnapshots();
    this.fallbackBridge.connect(this.destroyRef);
    this.wireDestroy();
  }

  send(event: PaymentFlowCommandEvent): boolean {
    const snap = this.snapshot();

    if (!this.canSendEvent(event, snap)) {
      return false;
    }

    this.handleResetEvent(event);
    this.lastSentEvent.set(event);
    this.telemetryReporter.recordCommandSent(snap, event);
    this.actor.send(event);
    return true;
  }

  /** Internal/system events (fallback orchestration). */
  sendSystem(event: PaymentFlowSystemEvent): void {
    const snap = this.snapshot();
    this.telemetryReporter.recordSystemEventSent(snap, event);
    this.actor.send(event);
  }

  private startActor(): void {
    this.actor.start();
    this.snapshotState.set(this.actor.getSnapshot() as PaymentFlowSnapshot);
  }

  private subscribeToSnapshots(): void {
    this.actor.subscribe((snapshot) => {
      this.snapshotPipeline.handleSnapshot(snapshot as PaymentFlowSnapshot);
    });
  }

  private canSendEvent(event: PaymentFlowCommandEvent, snapshot: PaymentFlowSnapshot): boolean {
    if (!snapshot.can(event)) {
      this.logIgnoredEvent(event, snapshot);
      return false;
    }
    return true;
  }

  private logIgnoredEvent(event: PaymentFlowCommandEvent, snapshot: PaymentFlowSnapshot): void {
    const prevState = this.snapshotState.get()?.value ?? null;
    const changed = false; // No transition when the event is ignored
    const tags = snapshot.tags ? Array.from(snapshot.tags) : undefined;

    this.logger.warn(
      'Event ignored by machine (cannot transition)',
      'PaymentFlowActorService',
      {
        event,
        state: snapshot.value,
        prevState,
        changed,
        ...(tags && { tags }),
        context: snapshot.context,
      },
      this.logger.getCorrelationId(),
    );
  }

  private handleResetEvent(event: PaymentFlowCommandEvent): void {
    if (event.type !== 'RESET') return;
    this.contextPersistence.clear();
  }

  private wireDestroy(): void {
    this.destroyRef.onDestroy(() => {
      this.logger.info('Stopping payment flow actor', 'PaymentFlowActorService');
      this.actor.stop();
    });
  }
}
