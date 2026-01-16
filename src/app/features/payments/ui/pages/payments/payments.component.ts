import { Component, computed, inject, signal } from "@angular/core";
import { PaymentMethodType, PaymentProviderId } from "../../../domain/models/payment.types";
import { CreatePaymentRequest } from "../../../domain/models/payment.requests";
import { PaymentsFacade } from "../../facades/payments-facade";
import { ProviderFactory } from "../../../domain/ports/provider-factory.port";
import { PAYMENT_PROVIDER_FACTORIES } from "../../../application/tokens/payment-provider-factories.token";
import { ProviderFactoryRegistry } from "../../../application/registry/provider-factory.registry";
import { CommonModule } from "@angular/common";

type SelfTestRow = {
    providerId: PaymentProviderId | string;
    factoryClass: string;
    method: PaymentMethodType;
    supported: boolean;
    strategyClass?: string;
    error?: string;

    // opcional: resultado del smoke start
    smokeStart?: 'skipped' | 'ok' | 'error';
    smokeResult?: any;
};


@Component({
    selector: 'app-payments',
    templateUrl: './payments.component.html',
    imports: [CommonModule]
})
export class PaymentsComponent {
    private readonly factories = inject<ProviderFactory[]>(PAYMENT_PROVIDER_FACTORIES);
    private readonly registry = inject(ProviderFactoryRegistry);

    // ✅ Opcional: para probar flujo completo StartPaymentUseCase → Registry → Factory → Strategy → Gateway
    readonly facade = inject(PaymentsFacade);

    // Providers disponibles (del multi token)
    readonly providerIds = computed<PaymentProviderId[]>(() => {
        const ids = this.factories.map(f => f.providerId);
        return Array.from(new Set(ids)) as PaymentProviderId[];
    });

    // UI state
    readonly selectedProviderId = signal<PaymentProviderId>('stripe');
    readonly selectedMethodType = signal<PaymentMethodType>('card');

    // Info calculada (para debug/validación)
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
        }))
    );

    readonly factoriesCount = computed(() => this.factories.length);

    readonly duplicates = computed(() => {
        const ids = this.factories.map((f) => f.providerId);
        return ids.filter((id, i) => ids.indexOf(id) !== i);
    });

    onSelectProvider(providerId: PaymentProviderId) {
        this.selectedProviderId.set(providerId);
        this.facade.reset(); // opcional: limpiar estado de pago si cambias provider
    }

    onSelectMethod(method: PaymentMethodType) {
        this.selectedMethodType.set(method);
        this.facade.reset();
    }

    // ✅ Prueba de pipeline completo (StartPaymentUseCase etc.)
    startTestPayment() {
        const providerId = this.selectedProviderId();
        const method = this.selectedMethodType();

        const req: CreatePaymentRequest = {
            orderId: 'order_demo',
            amount: 100,
            currency: 'MXN',
            method:
                method === 'card'
                    ? { type: 'card', token: 'tok_demo' } // 👈 requerido por validateCreate()
                    : { type: 'spei' },
        };

        this.facade.start(req, providerId);
    }

    readonly selfTestRunning = signal(false);
    readonly selfTestRows = signal<SelfTestRow[]>([]);
    readonly selfTestSummary = computed(() => {
        const rows = this.selfTestRows();
        const supported = rows.filter(r => r.supported).length;
        const notSupported = rows.filter(r => !r.supported).length;
        const smokeOk = rows.filter(r => r.smokeStart === 'ok').length;
        const smokeErr = rows.filter(r => r.smokeStart === 'error').length;

        return { total: rows.length, supported, notSupported, smokeOk, smokeErr };
    });

    async runSelfTest(options?: { smokeStart?: boolean }) {
        const smokeStart = options?.smokeStart ?? false;

        this.selfTestRunning.set(true);
        this.selfTestRows.set([]);

        const methods: PaymentMethodType[] = ['card', 'spei'];

        const rows: SelfTestRow[] = [];

        // 1) Validación de multi token y duplicados
        const duplicates = this.duplicates();
        if (duplicates.length > 0) {
            console.warn('⚠️ Duplicate providers detected:', duplicates);
        }

        // 2) Recorremos providers disponibles según lo que inyectó el token
        for (const providerId of this.providerIds()) {
            let factory: ProviderFactory;

            try {
                factory = this.registry.get(providerId);
            } catch (e) {
                // si el registry falla, agregamos filas de error para ambos métodos
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
                // 3) Probar createStrategy(type)
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

        // 4) Mostrar tabla en consola (puro placer)
        console.group('💀 Payments Self Test (Registry + Multi DI + Factories)');
        console.table(
            rows.map(r => ({
                providerId: r.providerId,
                factoryClass: r.factoryClass,
                method: r.method,
                supported: r.supported,
                strategyClass: r.strategyClass ?? '',
                error: r.error ?? '',
            }))
        );
        console.groupEnd();

        this.selfTestRows.set(rows);

        // 5) Opcional: SMOKE START (dispara el pipeline real)
        // OJO: Esto puede pegarle al HTTP real si no tienes backend.
        // Aún así sirve: "ok" si responde, "error" si falla.
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

            // Construir request válido (card requiere token)
            const req: CreatePaymentRequest = {
                orderId: 'order_smoke',
                amount: 123,
                currency: 'MXN',
                method:
                    row.method === 'card'
                        ? { type: 'card', token: 'tok_demo' }
                        : { type: 'spei' },
            };

            try {
                // Usamos el Facade para probar la cadena completa:
                // Facade → UseCase → Registry → Factory → Strategy → Gateway
                this.facade.reset();
                this.facade.start(req, row.providerId as any);

                // esperamos un poquito a que actualice state (por si hay async real)
                // Nota: si tu backend no existe, caerá en error y también es válido
                await new Promise(resolve => setTimeout(resolve, 150));

                if (this.facade.intent()) {
                    row.smokeStart = 'ok';
                    row.smokeResult = this.facade.intent();
                } else if (this.facade.error()) {
                    row.smokeStart = 'error';
                    row.smokeResult = this.facade.error();
                } else {
                    // Si quedó loading o nada pasó, lo marcamos como error “inconcluso”
                    row.smokeStart = 'error';
                    row.smokeResult = { message: 'No intent/error after timeout (inconclusive)' };
                }
            } catch (e) {
                row.smokeStart = 'error';
                row.smokeResult = e;
            }

            // refrescar UI progresivamente
            this.selfTestRows.set([...rows]);
        }

        console.group('🔥 Payments Smoke Start Results');
        console.table(
            rows.map(r => ({
                providerId: r.providerId,
                method: r.method,
                supported: r.supported,
                smokeStart: r.smokeStart,
                smokeResult: r.smokeStart === 'ok' ? 'intent ✅' : r.smokeStart === 'error' ? 'error ❌' : 'skipped',
            }))
        );
        console.groupEnd();
    }

}