import type { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type {
  PaymentFlowSnapshot,
  PaymentFlowSystemEvent,
} from '@payments/application/orchestration/flow/payment-flow/deps/payment-flow.types';
import type { FallbackOrchestratorService } from '@payments/application/orchestration/services/fallback/fallback-orchestrator.service';
import type { PaymentIntentId } from '@payments/domain/common/primitives/ids/payment-intent-id.vo';

/**
 * Bridges fallback orchestration events and snapshot-driven signals.
 */
export class PaymentFlowFallbackBridge {
  private lastReportedError: PaymentError | null = null;
  private lastSuccessIntentId: PaymentIntentId | null = null;

  constructor(
    private readonly fallbackOrchestrator: FallbackOrchestratorService,
    private readonly sendSystem: (event: PaymentFlowSystemEvent) => void,
  ) {}

  connect(destroyRef: DestroyRef): void {
    this.fallbackOrchestrator.fallbackExecute$
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(({ provider, request, fromProvider }) => {
        this.sendSystem({
          type: 'FALLBACK_EXECUTE',
          providerId: provider,
          request,
          failedProviderId: fromProvider,
        });
      });
  }

  handleSnapshot(snapshot: PaymentFlowSnapshot): void {
    this.maybeReportFallback(snapshot);
    this.maybeNotifyFallbackSuccess(snapshot);
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
}
