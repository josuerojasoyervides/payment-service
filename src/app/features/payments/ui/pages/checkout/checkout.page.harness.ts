import { effect, type EffectRef } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LoggerService } from '@app/core';
import { FALLBACK_CONFIG } from '@app/features/payments/application/orchestration/services/fallback/fallback-orchestrator.service';
import providePayments from '@app/features/payments/config/payment.providers';
import type { PaymentFlowPort } from '@payments/application/api/ports/payment-store.port';
import { DEFAULT_FALLBACK_CONFIG } from '@payments/application/orchestration/services/fallback/fallback-config.constant';
import { vi } from 'vitest';

/**
 * Wait for a signal-driven condition using Angular's `effect`.
 * - No polling
 * - Works in zoneless (Angular 21)
 * - Uses a single REAL timeout to fail fast if stuck
 *
 * IMPORTANT:
 * - This helper expects REAL timers. If your test uses vi.useFakeTimers(), it will throw.
 */
export function waitFor(
  condition: () => boolean,
  timeoutMs = 2000,
  debugMessage?: () => string,
): Promise<void> {
  if (vi.isFakeTimers()) {
    throw new Error(
      [
        'waitFor() requires REAL timers.',
        'You are currently using fake timers (vi.useFakeTimers()).',
        'Fix: call vi.useRealTimers() for this integration test/harness,',
        'or create a dedicated fake-timers helper that advances time explicitly.',
      ].join('\n'),
    );
  }

  return new Promise((resolve, reject) => {
    let ref: EffectRef | null = null;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let done = false;

    const finalize = (fn: () => void) => {
      if (done) return;
      done = true;

      try {
        ref?.destroy();
      } finally {
        ref = null;
      }

      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }

      fn();
    };

    // Programar timeout primero (y guardarlo en variable segura)
    timeoutHandle = setTimeout(() => {
      finalize(() => {
        reject(new Error(debugMessage?.() ?? `Condition not met within ${timeoutMs}ms`));
      });
    }, timeoutMs);

    // Crear efecto después; puede correr inmediatamente, pero ya tenemos timeoutHandle seguro.
    ref = TestBed.runInInjectionContext(() =>
      effect(() => {
        let ok = false;
        try {
          ok = condition();
        } catch (err) {
          finalize(() => reject(err instanceof Error ? err : new Error(String(err))));
          return;
        }

        if (ok) {
          finalize(() => resolve());
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
            status: summary.status,
            isLoading: summary.status === 'loading',
            isReady: summary.status === 'ready',
            hasError: summary.status === 'error',
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
      `Intent status did not become "${status}" within ${maxWaitMs}ms. Current: ${
        state.intent()?.status ?? 'null'
      }`,
  );

  if (state.hasError()) {
    throw new Error(
      `Intent status did not become "${status}" within ${maxWaitMs}ms. Flow has error: ${
        state.error()?.code ?? 'unknown'
      }`,
    );
  }
}

export async function waitUntilIdle(state: PaymentFlowPort, maxWaitMs = 500): Promise<void> {
  // "Idle" aquí lo interpreto como "no loading" y sin intent final aún.
  // Ajusta si tu state machine define idle distinto.
  await waitFor(() => !state.isLoading(), maxWaitMs);
}

export async function settle(fixture: ComponentFixture<any>): Promise<void> {
  // Más robusto: siempre asegura al menos un ciclo de CD alrededor de whenStable
  fixture.detectChanges();
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
      triggerErrorCodes: ['provider_unavailable', 'network_error', 'timeout'],
      blockedErrorCodes: ['card_declined'],
    },
  },
];
