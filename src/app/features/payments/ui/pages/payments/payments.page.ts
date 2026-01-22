import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ProviderFactoryRegistry } from '../../../application/registry/provider-factory.registry';
import { PAYMENT_PROVIDER_FACTORIES } from '../../../application/tokens/payment-provider-factories.token';
import { PAYMENT_STATE } from '../../../application/tokens/payment-state.token';
import {
  CreatePaymentRequest,
  PaymentIntent,
  PaymentMethodType,
  PaymentProviderId,
} from '../../../domain/models';
import { ProviderFactory } from '../../../domain/ports';

type SmokeStartStatus = 'skipped' | 'ok' | 'error';

type SmokeResult =
  | { kind: 'intent'; intent: PaymentIntent }
  | { kind: 'error'; error: unknown }
  | { kind: 'inconclusive'; message: string };

interface SelfTestRow {
  providerId: PaymentProviderId | string;
  factoryClass: string;
  method: PaymentMethodType;
  supported: boolean;
  strategyClass?: string;
  error?: string;

  smokeStart?: SmokeStartStatus;
  smokeResult?: SmokeResult;
}

/**
 * Payment status and testing component.
 *
 * This component is decoupled from state implementation
 * thanks to the PAYMENT_STATE token.
 */
@Component({
  selector: 'app-payments',
  templateUrl: './payments.component.html',
  imports: [CommonModule],
})
export class PaymentsComponent implements OnDestroy {
  private readonly factories = inject<ProviderFactory[]>(PAYMENT_PROVIDER_FACTORIES);
  private readonly registry = inject(ProviderFactoryRegistry);
  private readonly paymentState = inject(PAYMENT_STATE);

  // UI state derivado del port (usando signals directamente)
  readonly isLoading = this.paymentState.isLoading;
  readonly intent = this.paymentState.intent;
  readonly error = this.paymentState.error;

  private readonly unsubscribe = this.paymentState.subscribe(() => {
    const snapshot = this.paymentState.getSnapshot();

    if (this.actionLoading() && snapshot.status !== 'loading') {
      if (snapshot.status === 'ready') {
        this.actionResult.set(snapshot.intent);
      }
      if (snapshot.status === 'error') {
        this.actionError.set(snapshot.error);
      }
      this.actionLoading.set(false);
    }
  });

  readonly providerIds = computed<PaymentProviderId[]>(() => {
    const ids = this.factories.map((f) => f.providerId);
    return Array.from(new Set(ids)) as PaymentProviderId[];
  });

  // UI state
  readonly selectedProviderId = signal<PaymentProviderId>('stripe');
  readonly selectedMethodType = signal<PaymentMethodType>('card');

  // Intent actions UI state
  readonly intentIdInput = signal('');
  readonly actionLoading = signal(false);
  readonly actionResult = signal<PaymentIntent | null>(null);
  readonly actionError = signal<unknown | null>(null);

  readonly resolvedFactory = computed(() => {
    const providerId = this.selectedProviderId();
    try {
      return this.registry.get(providerId);
    } catch (e) {
      return e as Error;
    }
  });

  readonly factoryClassName = computed(() => {
    const factory = this.resolvedFactory();
    if (factory instanceof Error) return '(error)';
    return factory.constructor?.name ?? '(unknown factory)';
  });

  readonly supportedMethods = computed(() => {
    const factory = this.resolvedFactory();
    if (factory instanceof Error) return [];

    const methods: PaymentMethodType[] = ['card', 'spei'];

    return methods.map((m) => {
      try {
        const strategy = factory.createStrategy(m);
        return {
          method: m,
          supported: true,
          strategyClassName: strategy.constructor?.name ?? '(unknown strategy)',
        };
      } catch (e) {
        return {
          method: m,
          supported: false,
          strategyClassName: null,
          error: (e as Error).message,
        };
      }
    });
  });

  readonly hasFactoryError = computed(() => this.resolvedFactory() instanceof Error);

  readonly factoriesDebug = computed(() =>
    this.factories.map((f) => ({
      providerId: f.providerId,
      className: f.constructor?.name ?? '(unknown)',
    })),
  );

  readonly factoriesCount = computed(() => this.factories.length);

  readonly duplicates = computed(() => {
    const ids = this.factories.map((f) => f.providerId);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  });

  onSelectProvider(providerId: PaymentProviderId) {
    this.selectedProviderId.set(providerId);
    this.paymentState.reset();
    this.resetActionState();
  }

  onSelectMethod(method: PaymentMethodType) {
    this.selectedMethodType.set(method);
    this.paymentState.reset();
    this.resetActionState();
  }

  startTestPayment() {
    const providerId = this.selectedProviderId();
    const method = this.selectedMethodType();

    const req: CreatePaymentRequest = {
      orderId: 'order_demo',
      amount: 100,
      currency: 'MXN',
      method: method === 'card' ? { type: 'card', token: 'tok_demo' } : { type: 'spei' },
    };

    this.paymentState.startPayment(req, providerId);
  }

  onIntentIdInput(value: string) {
    this.intentIdInput.set(value.trim());
  }

  readonly selfTestRunning = signal(false);
  readonly selfTestRows = signal<SelfTestRow[]>([]);
  readonly selfTestSummary = computed(() => {
    const rows = this.selfTestRows();
    const supported = rows.filter((r) => r.supported).length;
    const notSupported = rows.filter((r) => !r.supported).length;
    const smokeOk = rows.filter((r) => r.smokeStart === 'ok').length;
    const smokeErr = rows.filter((r) => r.smokeStart === 'error').length;

    return { total: rows.length, supported, notSupported, smokeOk, smokeErr };
  });

  async runSelfTest(options?: { smokeStart?: boolean }) {
    const smokeStart = options?.smokeStart ?? false;

    this.selfTestRunning.set(true);
    this.selfTestRows.set([]);

    const methods: PaymentMethodType[] = ['card', 'spei'];

    const rows: SelfTestRow[] = [];

    const duplicates = this.duplicates();
    if (duplicates.length > 0) {
      console.warn('⚠️ Duplicate providers detected:', duplicates);
    }

    for (const providerId of this.providerIds()) {
      let factory: ProviderFactory;

      try {
        factory = this.registry.get(providerId);
      } catch (e) {
        for (const m of methods) {
          rows.push({
            providerId,
            factoryClass: '(error)',
            method: m,
            supported: false,
            error: (e as Error).message,
            smokeStart: 'skipped',
          });
        }
        continue;
      }

      const factoryClass = factory.constructor?.name ?? '(unknown factory)';

      for (const m of methods) {
        try {
          const strategy = factory.createStrategy(m);
          const strategyClass = strategy.constructor?.name ?? '(unknown strategy)';

          const row: SelfTestRow = {
            providerId,
            factoryClass,
            method: m,
            supported: true,
            strategyClass,
            smokeStart: smokeStart ? 'skipped' : 'skipped',
          };

          rows.push(row);
        } catch (e) {
          rows.push({
            providerId,
            factoryClass,
            method: m,
            supported: false,
            error: (e as Error).message,
            smokeStart: 'skipped',
          });
        }
      }
    }

    console.group('💀 Payments Self Test (Registry + Multi DI + Factories)');
    console.table(
      rows.map((r) => ({
        providerId: r.providerId,
        factoryClass: r.factoryClass,
        method: r.method,
        supported: r.supported,
        strategyClass: r.strategyClass ?? '',
        error: r.error ?? '',
      })),
    );
    console.groupEnd();

    this.selfTestRows.set(rows);

    if (smokeStart) {
      await this.runSmokeStartOnSupportedRows();
    }

    this.selfTestRunning.set(false);
  }

  private async runSmokeStartOnSupportedRows() {
    const rows = [...this.selfTestRows()];

    for (const row of rows) {
      if (!row.supported) {
        row.smokeStart = 'skipped';
        continue;
      }

      const req: CreatePaymentRequest = {
        orderId: 'order_smoke',
        amount: 123,
        currency: 'MXN',
        method: row.method === 'card' ? { type: 'card', token: 'tok_demo' } : { type: 'spei' },
      };

      try {
        this.paymentState.reset();
        this.paymentState.startPayment(req, row.providerId as PaymentProviderId);

        await new Promise((resolve) => setTimeout(resolve, 150));

        const intent = this.intent();
        const err = this.error();

        if (intent) {
          row.smokeStart = 'ok';
          row.smokeResult = { kind: 'intent', intent };
        } else if (err) {
          row.smokeStart = 'error';
          row.smokeResult = { kind: 'error', error: err };
        } else {
          row.smokeStart = 'error';
          row.smokeResult = {
            kind: 'inconclusive',
            message: 'No intent/error after timeout (inconclusive)',
          };
        }
      } catch (e) {
        row.smokeStart = 'error';
        row.smokeResult = { kind: 'error', error: e };
      }

      this.selfTestRows.set([...rows]);
    }

    console.group('🔥 Payments Smoke Start Results');
    console.table(
      rows.map((r) => ({
        providerId: r.providerId,
        method: r.method,
        supported: r.supported,
        smokeStart: r.smokeStart,
        smokeResult:
          r.smokeStart === 'ok' ? 'intent ✅' : r.smokeStart === 'error' ? 'error ❌' : 'skipped',
      })),
    );
    console.groupEnd();
  }

  confirmIntent() {
    const intentId = this.getIntentIdForActions();
    if (!intentId) return;

    this.actionLoading.set(true);
    this.actionError.set(null);
    this.actionResult.set(null);

    this.paymentState.confirmPayment({ intentId }, this.selectedProviderId());
  }

  cancelIntent() {
    const intentId = this.getIntentIdForActions();
    if (!intentId) return;

    this.actionLoading.set(true);
    this.actionError.set(null);
    this.actionResult.set(null);

    this.paymentState.cancelPayment({ intentId }, this.selectedProviderId());
  }

  refreshStatus() {
    const intentId = this.getIntentIdForActions();
    if (!intentId) return;

    this.actionLoading.set(true);
    this.actionError.set(null);
    this.actionResult.set(null);

    this.paymentState.refreshPayment({ intentId }, this.selectedProviderId());
  }

  private getIntentIdForActions(): string | null {
    const fromInput = this.intentIdInput();
    const fromState = this.intent()?.id ?? '';
    const intentId = fromInput || fromState;

    if (!intentId) {
      this.actionError.set({ message: 'No intent id available' });
      return null;
    }
    return intentId;
  }

  private resetActionState() {
    this.actionLoading.set(false);
    this.actionResult.set(null);
    this.actionError.set(null);
  }

  ngOnDestroy() {
    this.unsubscribe();
  }
}
