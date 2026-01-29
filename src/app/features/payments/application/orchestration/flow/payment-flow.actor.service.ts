import type { Signal } from '@angular/core';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LoggerService } from '@core/logging';
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
  FlowContextStore,
  toFlowContext,
} from '@payments/application/orchestration/flow/payment-flow/persistence/payment-flow.persistence';
import {
  isPaymentFlowSnapshot,
  isSnapshotInspectionEventWithSnapshot,
} from '@payments/application/orchestration/flow/payment-flow/policy/payment-flow.guards';
import { FallbackOrchestratorService } from '@payments/application/orchestration/services/fallback-orchestrator.service';
import { NextActionOrchestratorService } from '@payments/application/orchestration/services/next-action-orchestrator.service';
import { CancelPaymentUseCase } from '@payments/application/orchestration/use-cases/cancel-payment.use-case';
import { ConfirmPaymentUseCase } from '@payments/application/orchestration/use-cases/confirm-payment.use-case';
import { GetPaymentStatusUseCase } from '@payments/application/orchestration/use-cases/get-payment-status.use-case';
import { StartPaymentUseCase } from '@payments/application/orchestration/use-cases/start-payment.use-case';
import type { NextAction } from '@payments/domain/subdomains/payment/contracts/payment-action.types';
import type { PaymentError } from '@payments/domain/subdomains/payment/contracts/payment-error.types';
import type { PaymentFlowContext } from '@payments/domain/subdomains/payment/contracts/payment-flow-context.types';
import { firstValueFrom } from 'rxjs';
import { createActor } from 'xstate';

function createFlowContextStore(): FlowContextStore | null {
  try {
    if (typeof globalThis === 'undefined') return null;
    if (!('localStorage' in globalThis)) return null;
    return new FlowContextStore(globalThis.localStorage);
  } catch {
    return null;
  }
}

function buildInitialMachineContext(
  store: FlowContextStore | null,
): Partial<PaymentFlowMachineContext> | undefined {
  const persisted = store?.load();
  if (!persisted) return undefined;

  const flowContext = toFlowContext(persisted);
  const providerId = flowContext.providerId ?? null;
  const intentId = providerId ? (flowContext.providerRefs?.[providerId]?.intentId ?? null) : null;

  return {
    flowContext,
    providerId,
    intentId,
  };
}

function redactNextAction(action?: NextAction): NextAction | undefined {
  if (!action) return action;
  if (action.kind !== 'client_confirm') return action;
  return { ...action, token: '[redacted]' };
}

function redactFlowContext(context: PaymentFlowContext | null): PaymentFlowContext | null {
  return context ?? null;
}

function redactIntent(
  intent: PaymentFlowSnapshot['context']['intent'],
): PaymentFlowSnapshot['context']['intent'] {
  if (!intent) return intent;
  return {
    ...intent,
    clientSecret: intent.clientSecret ? '[redacted]' : intent.clientSecret,
    nextAction: redactNextAction(intent.nextAction),
    raw: undefined,
  };
}

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

  private readonly flowContextStore = createFlowContextStore();
  private readonly initialContext = buildInitialMachineContext(this.flowContextStore);

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
    {},
    this.initialContext,
  );

  private prevSnapshot: PaymentFlowSnapshot | null = null;
  private lastReportedError: PaymentError | null = null;
  private lastSuccessIntentId: string | null = null;

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

  readonly isIdle = computed(() => this.snapshot().hasTag('idle'));
  readonly isLoading = computed(() => this.snapshot().hasTag('loading'));
  readonly isReady = computed(() => this.snapshot().hasTag('ready'));
  readonly hasError = computed(() => this.snapshot().hasTag('error'));

  constructor() {
    this.actor.start();

    this.prevSnapshot = this.actor.getSnapshot() as PaymentFlowSnapshot;
    this.actor.subscribe((snapshot) => {
      this._snapshot.set(snapshot);
      this.persistFlowContext(snapshot);
      this.maybeReportFallback(snapshot);
      this.maybeNotifyFallbackSuccess(snapshot);
    });

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
    this.destroyRef.onDestroy(() => {
      this.logger.info('Stopping payment flow actor', 'PaymentFlowActorService');
      this.actor.stop();
    });
  }

  send(event: PaymentFlowCommandEvent): boolean {
    const snap = this.snapshot();

    const prevState = this.prevSnapshot?.value ?? null;
    const changed = false; // No transition when the event is ignored
    const tags = snap.tags ? Array.from(snap.tags) : undefined;

    if (!snap.can(event)) {
      this.logger.warn(
        'Event ignored by machine (cannot transition)',
        'PaymentFlowActorService',
        {
          event,
          state: snap.value,
          prevState,
          changed,
          ...(tags && { tags }),
          context: snap.context,
        },
        this.logger.getCorrelationId(),
      );
      return false;
    }

    if (event.type === 'RESET') {
      this.flowContextStore?.clear();
    }

    this.lastSentEvent.set(event);
    this.actor.send(event);
    return true;
  }

  /** Internal/system events (fallback orchestration). */
  sendSystem(event: PaymentFlowSystemEvent): void {
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
    if (!intentId || intentId === this.lastSuccessIntentId) return;

    const fallbackStatus = this.fallbackOrchestrator.state().status;
    if (fallbackStatus === 'idle') return;

    this.lastSuccessIntentId = intentId;
    this.fallbackOrchestrator.notifySuccess();
  }
}
