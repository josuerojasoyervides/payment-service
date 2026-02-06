import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentMethodType } from '@app/features/payments/domain/subdomains/payment/entities/payment-method.types';
import type { NextActionManualStep } from '@app/features/payments/domain/subdomains/payment/entities/payment-next-action.model';
import {
  createPaymentError,
  invalidRequestError,
} from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import type { CreatePaymentRequest } from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { intentRequiresUserAction } from '@app/features/payments/domain/subdomains/payment/policies/requires-user-action.policy';
import {
  SPEI_MAX_AMOUNT_MXN,
  SPEI_MIN_AMOUNT_MXN,
  validateSpeiAmount,
} from '@app/features/payments/domain/subdomains/payment/rules/spei-amount.rule';
import {
  formatSpeiPaymentConcept,
  generateSpeiReference,
} from '@app/features/payments/domain/subdomains/payment/rules/spei-concept.rule';
import { SPEI_DEFAULT_EXPIRY_HOURS } from '@app/features/payments/domain/subdomains/payment/rules/spei-expiry.rule';
import type { LoggerService } from '@core/logging';
import type { SpeiDisplayConfig } from '@payments/application/api/contracts/spei-display-config.types';
import type { PaymentGatewayPort } from '@payments/application/api/ports/payment-gateway.port';
import type {
  PaymentStrategy,
  StrategyContext,
  StrategyPrepareResult,
} from '@payments/application/api/ports/payment-strategy.port';
import { PAYMENT_ERROR_KEYS } from '@payments/shared/constants/payment-error-keys';
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

  constructor(
    private readonly gateway: PaymentGatewayPort,
    private readonly logger: LoggerService,
    private readonly displayConfig: SpeiDisplayConfig,
    private readonly amountValidator?: (money: CreatePaymentRequest['money']) => void,
  ) {}

  /**
   * Validates the request for SPEI payments.
   *
   * Uses domain rules (validateSpeiAmount) for amount/currency validation.
   * - Only accepts MXN
   * - Amount between 1 and 8,000,000 MXN
   * - Does not require token (unlike cards)
   */
  validate(req: CreatePaymentRequest): void {
    if (this.amountValidator) {
      this.amountValidator(req.money);
    } else {
      const violations = validateSpeiAmount(req.money);
      for (const v of violations) {
        switch (v.code) {
          case 'SPEI_INVALID_CURRENCY':
            throw invalidRequestError(PAYMENT_ERROR_KEYS.INVALID_REQUEST, {
              reason: 'spei_only_mxn',
              currency: req.money.currency,
            });
          case 'SPEI_AMOUNT_TOO_LOW':
            throw invalidRequestError(PAYMENT_ERROR_KEYS.MIN_AMOUNT, {
              amount: SPEI_MIN_AMOUNT_MXN,
              currency: req.money.currency,
            });
          case 'SPEI_AMOUNT_TOO_HIGH':
            throw invalidRequestError(PAYMENT_ERROR_KEYS.MAX_AMOUNT, {
              amount: SPEI_MAX_AMOUNT_MXN,
              currency: req.money.currency,
            });
        }
      }
    }

    if (req.method.token) {
      this.logger.warn('Token provided but will be ignored for SPEI payments', 'SpeiStrategy', {
        hasToken: true,
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
    const expiryHours = SPEI_DEFAULT_EXPIRY_HOURS;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    const metadata: Record<string, unknown> = {
      payment_method_type: 'spei',
      expires_at: expiresAt.toISOString(),
      expiry_hours: expiryHours,
      payment_concept: formatSpeiPaymentConcept(req.orderId),
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
      orderId: req.orderId.value,
      amount: req.money.amount,
      expiresAt: metadata['expires_at'],
    });
    return this.gateway.createIntent(preparedRequest).pipe(
      tap((intent) => {
        this.logger.warn(`[SpeiStrategy] SPEI source created: ${intent.id.value}`, 'SpeiStrategy', {
          intentId: intent.id.value,
        });
      }),
      map((intent) => this.enrichIntentWithSpeiInstructions(intent, req, metadata)),
    );
  }

  /**
   * SPEI always requires user action (perform the transfer).
   */
  requiresUserAction(intent: PaymentIntent): boolean {
    return intentRequiresUserAction(intent) && intent.nextAction?.kind === 'manual_step';
  }

  getUserInstructions(_intent: PaymentIntent): string[] | null {
    return null;
  }

  /**
   * Enriches the intent with complete SPEI information.
   */
  private enrichIntentWithSpeiInstructions(
    intent: PaymentIntent,
    req: CreatePaymentRequest,
    metadata: Record<string, unknown>,
  ): PaymentIntent {
    const clabe = this.extractClabeFromRaw(intent);
    if (!clabe) {
      throw createPaymentError('provider_error', PAYMENT_ERROR_KEYS.UNKNOWN_ERROR, {
        reason: 'missing_spei_clabe',
      });
    }

    const bankCode = this.extractBankCodeFromRaw(intent);
    if (!bankCode) {
      throw createPaymentError('provider_error', PAYMENT_ERROR_KEYS.UNKNOWN_ERROR, {
        reason: 'missing_spei_bank_code',
      });
    }

    if (!this.displayConfig.receivingBanks[bankCode]) {
      throw createPaymentError('provider_error', PAYMENT_ERROR_KEYS.UNKNOWN_ERROR, {
        reason: 'unknown_spei_bank_code',
        bankCode,
      });
    }

    const details = {
      bankCode,
      clabe,
      beneficiaryName: this.displayConfig.beneficiaryName,
      reference: generateSpeiReference(req.orderId),
      amount: req.money.amount,
      currency: req.money.currency,
      expiresAt: metadata['expires_at'] as string,
    };

    const speiAction: NextActionManualStep = {
      kind: 'manual_step',
      details,
    };

    return {
      ...intent,
      status: 'requires_action',
      nextAction: speiAction,
    };
  }

  /**
   * Attempts to extract CLABE from gateway raw response.
   */
  private extractClabeFromRaw(intent: PaymentIntent): string | null {
    const clabe =
      this.getStringFromUnknown(intent.raw, ['spei', 'clabe']) ??
      this.getStringFromUnknown(intent.raw, ['payment_method', 'clabe']);

    return clabe ?? null;
  }

  private extractBankCodeFromRaw(intent: PaymentIntent): string | null {
    const bankCode =
      this.getStringFromUnknown(intent.raw, ['spei', 'bank']) ??
      this.getStringFromUnknown(intent.raw, ['payment_method', 'bank']);

    const trimmed = bankCode?.trim();
    return trimmed ? trimmed : null;
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
