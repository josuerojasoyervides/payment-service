import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';
import { CreatePaymentRequest } from '@payments/domain/models/payment/payment-request.types';
import { filter } from 'rxjs';

import { FallbackOrchestratorService } from '../services/fallback-orchestrator.service';

export function setupFallbackExecuteListener(
  fallbackOrchestrator: Pick<FallbackOrchestratorService, 'fallbackExecute$' | 'state'>,
  startPayment: (args: { request: CreatePaymentRequest; providerId: PaymentProviderId }) => void,
): void {
  fallbackOrchestrator.fallbackExecute$
    .pipe(
      // ✅ Avoid infinite loops: only react while orchestrator is executing
      filter(() => {
        const status = fallbackOrchestrator.state().status;
        return status === 'auto_executing' || status === 'executing';
      }),
      takeUntilDestroyed(),
    )
    .subscribe(({ request, provider }) => {
      startPayment({ request, providerId: provider });
    });
}
