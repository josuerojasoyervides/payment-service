import { effect, type EffectRef } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LoggerService } from '@app/core';
import { FALLBACK_CONFIG } from '@app/features/payments/application/orchestration/services/fallback/fallback-orchestrator.service';
import providePayments from '@app/features/payments/config/payment.providers';
import { DEFAULT_FALLBACK_CONFIG } from '@app/features/payments/domain/subdomains/fallback/contracts/fallback-config.types';
import type { PaymentFlowPort } from '@payments/application/api/ports/payment-store.port';

/**
 * Wait for a signal-driven condition using Angular's `effect`.
 * - No polling
 * - Works in zoneless (Angular 21)
 * - Has a single real timeout to fail fast if stuck
 */
export function waitFor(
  condition: () => boolean,
  timeoutMs = 2000,
  debugMessage?: () => string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let ref: EffectRef | null = null;

    const cleanup = () => {
      if (ref) ref.destroy();
      clearTimeout(timeoutId);
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(debugMessage?.() ?? `Condition not met within ${timeoutMs}ms`));
    }, timeoutMs);

    ref = TestBed.runInInjectionContext(() =>
      effect(() => {
        if (condition()) {
          cleanup();
          resolve();
        }
      }),
    );
  });
}

export async function waitForPaymentComplete(
  state: PaymentFlowPort,
  maxWaitMs = 2000,
): Promise<void> {
  await waitFor(
    () => {
      const intent = state.intent();
      const isLoading = state.isLoading();
      const hasError = state.hasError();
      return (!!intent && !isLoading) || (hasError && !isLoading);
    },
    maxWaitMs,
    () => {
      const snap = state.getSnapshot();
      const summary = state.debugSummary();
      return (
        `Payment did not complete within ${maxWaitMs}ms.\n` +
        `Final state: ${JSON.stringify(
          {
            intent: !!snap.intent,
            isLoading: summary.status === 'loading',
            isReady: summary.status === 'ready',
            hasError: summary.status === 'error',
            status: summary.status,
          },
          null,
          2,
        )}`
      );
    },
  );
}

export async function waitForIntentStatus(
  state: PaymentFlowPort,
  status: string,
  maxWaitMs = 2500,
): Promise<void> {
  await waitFor(
    () => state.intent()?.status === status || state.hasError(),
    maxWaitMs,
    () =>
      `Intent status did not become "${status}" within ${maxWaitMs}ms. Current: ${state.intent()?.status ?? 'null'}`,
  );

  if (state.hasError()) {
    throw new Error(
      `Intent status did not become "${status}" within ${maxWaitMs}ms. Flow has error: ${state.error()?.code ?? 'unknown'}`,
    );
  }
}

export async function waitUntilIdle(state: PaymentFlowPort, maxWaitMs = 500): Promise<void> {
  await waitFor(() => !state.isReady() && !state.isLoading(), maxWaitMs);
}

export async function settle(fixture: ComponentFixture<any>): Promise<void> {
  await fixture.whenStable();
  fixture.detectChanges();
}

export const BASE_PROVIDERS = [
  ...providePayments(),
  provideRouter([]),
  LoggerService,
  {
    provide: FALLBACK_CONFIG,
    useValue: {
      ...DEFAULT_FALLBACK_CONFIG,
      triggerErrorCodes: ['provider_unavailable', 'provider_error', 'network_error'],
    },
  },
];
