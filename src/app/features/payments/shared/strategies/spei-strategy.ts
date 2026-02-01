import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import type { NextActionManualStep } from '@app/features/payments/domain/subdomains/payment/entities/payment-next-action.model';
import { invalidRequestError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { I18nKeys } from '@core/i18n';
import type { LoggerService } from '@core/logging';
import type { PaymentGatewayPort } from '@payments/application/api/ports/payment-gateway.port';
import type {
  PaymentStrategy,
  StrategyContext,
  StrategyPrepareResult,
} from '@payments/application/api/ports/payment-strategy.port';
import type { Observable } from 'rxjs';
import { map, tap } from 'rxjs';

/**
 * Strategy for payments via SPEI (Interbank Electronic Payments System).
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
    stripe: 'STP (Transfers and Payments System)',
    conekta: 'STP (Transfers and Payments System)',
    openpay: 'BBVA Mexico',
  };

  constructor(
    private readonly gateway: PaymentGatewayPort,
    private readonly logger: LoggerService,
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
      throw invalidRequestError(I18nKeys.errors.invalid_request, {
        reason: 'spei_only_mxn',
        currency: req.currency,
      });
    }

    if (req.amount < SpeiStrategy.MIN_AMOUNT_MXN) {
      throw invalidRequestError(I18nKeys.errors.min_amount, {
        amount: SpeiStrategy.MIN_AMOUNT_MXN,
        currency: req.currency,
      });
    }

    if (req.amount > SpeiStrategy.MAX_AMOUNT_MXN) {
      throw invalidRequestError(I18nKeys.errors.max_amount, {
        amount: SpeiStrategy.MAX_AMOUNT_MXN,
        currency: req.currency,
      });
    }

    if (req.method.token) {
      this.logger.warn('Token provided but will be ignored for SPEI payments', 'SpeiStrategy', {
        token: req.method.token,
      });
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
  prepare(req: CreatePaymentRequest, _context?: StrategyContext): StrategyPrepareResult {
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

    this.logger.warn(`[SpeiStrategy] Starting SPEI payment:`, 'SpeiStrategy', {
      orderId: req.orderId,
      amount: req.amount,
      expiresAt: metadata['expires_at'],
    });
    return this.gateway.createIntent(preparedRequest).pipe(
      tap((intent) => {
        this.logger.warn(`[SpeiStrategy] SPEI source created: ${intent.id}`, 'SpeiStrategy', {
          intentId: intent.id,
        });
      }),
      map((intent) => this.enrichIntentWithSpeiInstructions(intent, req, metadata)),
    );
  }

  /**
   * SPEI always requires user action (perform the transfer).
   */
  requiresUserAction(intent: PaymentIntent): boolean {
    return intent.status === 'requires_action' && intent.nextAction?.kind === 'manual_step';
  }

  /**
   * Generates detailed instructions for the user.
   */
  getUserInstructions(intent: PaymentIntent): string[] | null {
    if (!intent.nextAction || intent.nextAction.kind !== 'manual_step') {
      return null;
    }
    return [
      `Complete the transfer using the details below.`,
      `Transfer the exact amount to avoid rejections.`,
      `Keep your transfer receipt.`,
    ];
  }

  /**
   * Enriches the intent with complete SPEI information.
   */
  private enrichIntentWithSpeiInstructions(
    intent: PaymentIntent,
    req: CreatePaymentRequest,
    metadata: Record<string, unknown>,
  ): PaymentIntent {
    const details = [
      { label: 'CLABE', value: this.extractClabeFromRaw(intent) },
      { label: 'Reference', value: this.generateReference(req.orderId) },
      {
        label: 'Bank',
        value: SpeiStrategy.RECEIVING_BANKS[intent.provider] ?? 'STP',
      },
      { label: 'Beneficiary', value: 'Payment Service SA de CV' },
      { label: 'Amount', value: `${req.amount} ${req.currency}` },
      { label: 'Expires At', value: metadata['expires_at'] as string },
    ];

    const speiAction: NextActionManualStep = {
      kind: 'manual_step',
      instructions: this.getUserInstructions(intent) ?? [
        'Make a bank transfer using the details below.',
      ],
      details,
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
