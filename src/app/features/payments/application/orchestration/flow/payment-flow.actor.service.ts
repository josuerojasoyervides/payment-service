import type { Signal } from '@angular/core';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FLOW_CONTEXT_STORAGE } from '@app/features/payments/application/api/tokens/flow/flow-context-storage.token';
import { FLOW_TELEMETRY_SINK } from '@app/features/payments/application/api/tokens/telemetry/flow-telemetry-sink.token';
import {
  recordCommandSent,
  recordEffectTelemetry,
  recordErrorTelemetry,
  recordStateTelemetry,
  recordSystemEventSent,
} from '@app/features/payments/application/orchestration/flow/payment-flow/deps/payment-flow.actor.telemetry';
import { FallbackOrchestratorService } from '@app/features/payments/application/orchestration/services/fallback/fallback-orchestrator.service';
import { NextActionOrchestratorService } from '@app/features/payments/application/orchestration/services/next-action/next-action-orchestrator.service';
import { CancelPaymentUseCase } from '@app/features/payments/application/orchestration/use-cases/intent/cancel-payment.use-case';
import { ConfirmPaymentUseCase } from '@app/features/payments/application/orchestration/use-cases/intent/confirm-payment.use-case';
import { GetPaymentStatusUseCase } from '@app/features/payments/application/orchestration/use-cases/intent/get-payment-status.use-case';
import { StartPaymentUseCase } from '@app/features/payments/application/orchestration/use-cases/intent/start-payment.use-case';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import { LoggerService } from '@core/logging';
import { deepComputed } from '@ngrx/signals';
import { createPaymentFlowMachine } from '@payments/application/orchestration/flow/payment-flow.machine';
import {
  buildInitialMachineContext,
  redactFlowContext,
  redactIntent,
  snapshotTelemetryBase,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.actor.utils';
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
import { FlowContextStore } from '@payments/application/orchestration/flow/payment-flow/persistence/payment-flow.persistence';
import {
  isPaymentFlowSnapshot,
  isSnapshotInspectionEventWithSnapshot,
} from '@payments/application/orchestration/flow/payment-flow/policy/payment-flow.guards';
import type { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';
import { firstValueFrom } from 'rxjs';
import { createActor } from 'xstate';

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
  private readonly flowContextStore = new FlowContextStore(this.flowContextStorage);
  private readonly initialContext: Partial<PaymentFlowMachineContext> = {
    ...(buildInitialMachineContext(this.flowContextStore) ?? {}),
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

  private prevSnapshot: PaymentFlowSnapshot | null = null;
  private lastReportedError: PaymentError | null = null;
  private lastSuccessIntentId: PaymentIntentId | null = null;
  private lastErrorCodeForTelemetry: string | null = null;

  private readonly actor: PaymentFlowActorRef = createActor(this.machine, {
    inspect: (insp) => {
      if (!isSnapshotInspectionEventWithSnapshot(insp, isPaymentFlowSnapshot)) return;

      const snap = insp.snapshot as PaymentFlowSnapshot;
      const prevState = this.prevSnapshot?.value ?? null;
      const changed = this.prevSnapshot?.value !== snap.value;
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

      this.prevSnapshot = snap;
    },
  });

  private _snapshot = signal(this.actor.getSnapshot() as PaymentFlowSnapshot);
  readonly snapshot: Signal<PaymentFlowSnapshot> = this._snapshot.asReadonly();
  readonly lastSentEvent = signal<PaymentFlowEvent | null>(null);

  readonly actorStatuses = deepComputed(() => ({
    isIdle: this.snapshot().hasTag('idle'),
    isLoading: this.snapshot().hasTag('loading'),
    isReady: this.snapshot().hasTag('ready'),
    hasError: this.snapshot().hasTag('error'),
  }));

  constructor() {
    this.startActor();
    this.subscribeToSnapshots();
    this.wireFallbackExecute();
    this.wireDestroy();
  }

  send(event: PaymentFlowCommandEvent): boolean {
    const snap = this.snapshot();

    if (!this.canSendEvent(event, snap)) {
      return false;
    }

    this.handleResetEvent(event);
    this.lastSentEvent.set(event);
    recordCommandSent(this.telemetry, snap, event);
    this.actor.send(event);
    return true;
  }

  /** Internal/system events (fallback orchestration). */
  sendSystem(event: PaymentFlowSystemEvent): void {
    const snap = this.snapshot();
    recordSystemEventSent(this.telemetry, snap, event);
    this.actor.send(event);
  }

  private persistFlowContext(snapshot: PaymentFlowSnapshot): void {
    if (!this.flowContextStore) return;
    if (snapshot.hasTag('done') || snapshot.hasTag('failed')) {
      this.flowContextStore.clear();
      return;
    }

    const flowContext = snapshot.context.flowContext;
    if (!flowContext) return;

    this.flowContextStore.save(flowContext);
  }

  private maybeReportFallback(snapshot: PaymentFlowSnapshot): void {
    if (!snapshot.hasTag('error')) {
      this.lastReportedError = null;
      return;
    }

    const error = snapshot.context.error;
    const providerId = snapshot.context.providerId;
    const request = snapshot.context.request;

    if (!error || !providerId || !request) return;
    if (this.lastReportedError === error) return;

    this.lastReportedError = error;

    const handled = this.fallbackOrchestrator.reportFailure(providerId, error, request, false);
    if (!handled) return;

    this.sendSystem({
      type: 'FALLBACK_REQUESTED',
      failedProviderId: providerId,
      request,
      mode: this.fallbackOrchestrator.getConfig().mode,
    });
  }

  private maybeNotifyFallbackSuccess(snapshot: PaymentFlowSnapshot): void {
    const intentId = snapshot.context.intent?.id ?? null;
    if (!intentId || intentId.value === this.lastSuccessIntentId?.value) return;

    const fallbackStatus = this.fallbackOrchestrator.state().status;
    if (fallbackStatus === 'idle') return;

    this.lastSuccessIntentId = intentId;
    this.fallbackOrchestrator.notifySuccess();
  }

  private startActor(): void {
    this.actor.start();
    this.prevSnapshot = this.actor.getSnapshot() as PaymentFlowSnapshot;
  }

  private subscribeToSnapshots(): void {
    this.actor.subscribe((snapshot) => {
      const prev = this.prevSnapshot;
      this._snapshot.set(snapshot);
      this.handleSnapshotTelemetry(snapshot, prev);
      this.prevSnapshot = snapshot;
      this.handleSnapshotSideEffects(snapshot);
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
    const prevState = this.prevSnapshot?.value ?? null;
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
    this.flowContextStore?.clear();
  }

  private handleSnapshotTelemetry(
    snapshot: PaymentFlowSnapshot,
    prevSnapshot: PaymentFlowSnapshot | null,
  ): void {
    const base = snapshotTelemetryBase(snapshot);
    const atMs = Date.now();

    recordEffectTelemetry(this.telemetry, snapshot, prevSnapshot, atMs, base);
    this.lastErrorCodeForTelemetry = recordErrorTelemetry(
      this.telemetry,
      snapshot,
      this.lastErrorCodeForTelemetry,
      atMs,
      base,
    );
    recordStateTelemetry(this.telemetry, snapshot, atMs, base);
  }

  private handleSnapshotSideEffects(snapshot: PaymentFlowSnapshot): void {
    this.persistFlowContext(snapshot);
    this.maybeReportFallback(snapshot);
    this.maybeNotifyFallbackSuccess(snapshot);
  }

  private wireFallbackExecute(): void {
    this.fallbackOrchestrator.fallbackExecute$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ provider, request, fromProvider }) => {
        this.sendSystem({
          type: 'FALLBACK_EXECUTE',
          providerId: provider,
          request,
          failedProviderId: fromProvider,
        });
      });
  }

  private wireDestroy(): void {
    this.destroyRef.onDestroy(() => {
      this.logger.info('Stopping payment flow actor', 'PaymentFlowActorService');
      this.actor.stop();
    });
  }
}
