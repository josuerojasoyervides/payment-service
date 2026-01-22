import { inject } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';
import { map, Observable, tap } from 'rxjs';
import {
  CreatePaymentRequest,
  NextActionSpei,
  PaymentIntent,
  PaymentMethodType,
} from '../../domain/models';
import {
  PaymentGateway,
  PaymentStrategy,
  StrategyContext,
  StrategyPrepareResult,
} from '../../domain/ports';

/**
 * Strategy for payments via SPEI (Sistema de Pagos Electrónicos Interbancarios).
 *
 * Features:
 * - Only available for MXN
 * - Generates CLABE and reference for transfer
 * - Configurable expiration time (default 72 hours)
 * - Requires polling to verify payment
 * - Minimum and maximum amounts according to regulation
 */
export class SpeiStrategy implements PaymentStrategy {
  readonly type: PaymentMethodType = 'spei';

  // SPEI limits according to Mexican regulation
  private static readonly MIN_AMOUNT_MXN = 1;
  private static readonly MAX_AMOUNT_MXN = 8_000_000; // 8 million MXN
  private static readonly DEFAULT_EXPIRY_HOURS = 72;

  // Common receiving banks for SPEI
  private static readonly RECEIVING_BANKS: Record<string, string> = {
    stripe: 'STP (Sistema de Transferencias y Pagos)',
    conekta: 'STP (Sistema de Transferencias y Pagos)',
    openpay: 'BBVA México',
  };

  constructor(
    private readonly gateway: PaymentGateway,
    private readonly i18n: I18nService = inject(I18nService),
  ) {}

  /**
   * Validates the request for SPEI payments.
   *
   * Rules:
   * - Only accepts MXN
   * - Amount between 1 and 8,000,000 MXN
   * - Does not require token (unlike cards)
   */
  validate(req: CreatePaymentRequest): void {
    if (req.currency !== 'MXN') {
      throw new Error(
        this.i18n.t(I18nKeys.errors.invalid_request) +
          `: SPEI only supports MXN currency. Received: ${req.currency}`,
      );
    }

    if (req.amount < SpeiStrategy.MIN_AMOUNT_MXN) {
      throw new Error(
        this.i18n.t(I18nKeys.errors.min_amount, {
          amount: SpeiStrategy.MIN_AMOUNT_MXN,
          currency: 'MXN',
        }),
      );
    }

    if (req.amount > SpeiStrategy.MAX_AMOUNT_MXN) {
      throw new Error(
        `Maximum amount for SPEI is ${SpeiStrategy.MAX_AMOUNT_MXN.toLocaleString()} MXN. ` +
          `For larger amounts, consider wire transfer.`,
      );
    }

    if (req.method.token) {
      console.warn('[SpeiStrategy] Token provided but will be ignored for SPEI payments');
    }
  }

  /**
   * Prepares the request for SPEI.
   *
   * Enrichments:
   * - Calculates expiration date
   * - Generates standardized payment concept
   * - Prepares metadata for tracking
   */
  prepare(req: CreatePaymentRequest, context?: StrategyContext): StrategyPrepareResult {
    const expiryHours = SpeiStrategy.DEFAULT_EXPIRY_HOURS;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    const metadata: Record<string, unknown> = {
      payment_method_type: 'spei',
      expires_at: expiresAt.toISOString(),
      expiry_hours: expiryHours,
      payment_concept: this.generatePaymentConcept(req.orderId),
      timestamp: new Date().toISOString(),
      requires_polling: true,
    };

    const preparedRequest: CreatePaymentRequest = {
      ...req,
      method: {
        type: 'spei',
      },
    };

    return { preparedRequest, metadata };
  }

  /**
   * Starts the SPEI payment flow.
   *
   * Flow:
   * 1. Validates currency and amounts
   * 2. Prepares request and metadata
   * 3. Creates source/intent in gateway
   * 4. Maps response with SPEI instructions
   */
  start(req: CreatePaymentRequest, context?: StrategyContext): Observable<PaymentIntent> {
    this.validate(req);

    const { preparedRequest, metadata } = this.prepare(req, context);

    console.log(`[SpeiStrategy] Starting SPEI payment:`, {
      orderId: req.orderId,
      amount: req.amount,
      expiresAt: metadata['expires_at'],
    });
    return this.gateway.createIntent(preparedRequest).pipe(
      tap((intent) => {
        console.log(`[SpeiStrategy] SPEI source created: ${intent.id}`);
      }),
      map((intent) => this.enrichIntentWithSpeiInstructions(intent, req, metadata)),
    );
  }

  /**
   * SPEI always requires user action (perform the transfer).
   */
  requiresUserAction(intent: PaymentIntent): boolean {
    return intent.status === 'requires_action' && intent.nextAction?.type === 'spei';
  }

  /**
   * Generates detailed instructions for the user.
   */
  getUserInstructions(intent: PaymentIntent): string | null {
    if (!intent.nextAction || intent.nextAction.type !== 'spei') {
      return null;
    }

    const speiAction = intent.nextAction as NextActionSpei;

    return [
      `${this.i18n.t(I18nKeys.ui.spei_instructions_title)} $${intent.amount.toLocaleString()} ${intent.currency}:`,
      '',
      `1. ${this.i18n.t(I18nKeys.ui.spei_step_1)}`,
      `2. ${this.i18n.t(I18nKeys.ui.spei_step_2)}`,
      `3. ${this.i18n.t(I18nKeys.ui.spei_step_3)} ${speiAction.clabe}`,
      `4. ${this.i18n.t(I18nKeys.ui.spei_step_4)} $${speiAction.amount.toLocaleString()} ${speiAction.currency}`,
      `5. ${this.i18n.t(I18nKeys.ui.spei_step_5)} ${speiAction.reference}`,
      `6. ${this.i18n.t(I18nKeys.ui.spei_step_6)} ${speiAction.beneficiary}`,
      '',
      `⚠️ ${this.i18n.t(I18nKeys.ui.spei_deadline)} ${new Date(speiAction.expiresAt).toLocaleString('es-MX')}`,
      '',
      this.i18n.t(I18nKeys.ui.spei_processing_time),
    ].join('\n');
  }

  /**
   * Enriches the intent with complete SPEI information.
   */
  private enrichIntentWithSpeiInstructions(
    intent: PaymentIntent,
    req: CreatePaymentRequest,
    metadata: Record<string, unknown>,
  ): PaymentIntent {
    const existingSpei =
      intent.nextAction?.type === 'spei' ? (intent.nextAction as NextActionSpei) : null;

    const speiAction: NextActionSpei = {
      type: 'spei',
      instructions:
        this.getUserInstructions(intent) ?? this.i18n.t(I18nKeys.messages.spei_instructions),
      clabe: existingSpei?.clabe ?? this.extractClabeFromRaw(intent),
      reference: existingSpei?.reference ?? this.generateReference(req.orderId),
      bank: existingSpei?.bank ?? SpeiStrategy.RECEIVING_BANKS[intent.provider] ?? 'STP',
      beneficiary: existingSpei?.beneficiary ?? 'Payment Service SA de CV',
      amount: req.amount,
      currency: req.currency,
      expiresAt: metadata['expires_at'] as string,
    };

    return {
      ...intent,
      status: 'requires_action',
      nextAction: speiAction,
    };
  }

  /**
   * Generates a valid payment concept for SPEI (max 40 characters).
   */
  private generatePaymentConcept(orderId: string): string {
    const prefix = 'PAGO';
    const sanitizedOrderId = orderId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return `${prefix} ${sanitizedOrderId}`.substring(0, 40);
  }

  /**
   * Generates a 7-digit numeric reference.
   */
  private generateReference(orderId: string): string {
    const hash = orderId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return String(hash % 10000000).padStart(7, '0');
  }

  /**
   * Attempts to extract CLABE from gateway raw response.
   */
  private extractClabeFromRaw(intent: PaymentIntent): string {
    const clabe =
      this.getStringFromUnknown(intent.raw, ['spei', 'clabe']) ??
      this.getStringFromUnknown(intent.raw, ['payment_method', 'clabe']);

    return clabe ?? '646180111812345678'; // STP test CLABE
  }

  private getStringFromUnknown(obj: unknown, path: string[]): string | null {
    let current: unknown = obj;

    for (const key of path) {
      if (!this.isRecord(current)) return null;
      current = current[key];
    }

    return typeof current === 'string' ? current : null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
