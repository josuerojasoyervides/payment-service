import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.types';
import type {
  PaymentIntent,
  PaymentProviderId,
} from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import { LoggerService } from '@core/logging';
import { invalidRequestError } from '@payments/domain/subdomains/payment/contracts/payment-error.factory';
import type {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/subdomains/payment/contracts/payment-request.command';
import type { Observable } from 'rxjs';
import { catchError, map, tap, throwError } from 'rxjs';

export interface PaymentGatewayPort {
  readonly providerId: PaymentProviderId;
  createIntent(req: CreatePaymentRequest): Observable<PaymentIntent>;
  confirmIntent(req: ConfirmPaymentRequest): Observable<PaymentIntent>;
  cancelIntent(req: CancelPaymentRequest): Observable<PaymentIntent>;
  getIntent(req: GetPaymentStatusRequest): Observable<PaymentIntent>;
}

export abstract class BasePaymentGateway<
  TCreateDto = unknown,
  TConfirmDto = unknown,
> implements PaymentGatewayPort {
  abstract readonly providerId: PaymentProviderId;

  protected readonly http = inject(HttpClient);
  protected readonly logger = inject(LoggerService);

  protected get logContext(): string {
    return `${this.providerId}Gateway`;
  }

  createIntent(req: CreatePaymentRequest): Observable<PaymentIntent> {
    this.validateCreate(req);
    const correlationId = this.logger.getCorrelationId();

    this.logger.info(
      `Creating payment intent`,
      this.logContext,
      { orderId: req.orderId, amount: req.amount, currency: req.currency, method: req.method.type },
      correlationId,
    );

    return this.createIntentRaw(req).pipe(
      map((dto) => this.mapIntent(dto)),
      tap((intent) => {
        this.logger.info(
          `Payment intent created`,
          this.logContext,
          { intentId: intent.id, status: intent.status },
          correlationId,
        );
      }),
      catchError((err) => {
        this.logger.error(
          `Failed to create payment intent`,
          this.logContext,
          err,
          { orderId: req.orderId },
          correlationId,
        );
        return throwError(() => this.normalizeError(err));
      }),
    );
  }

  confirmIntent(req: ConfirmPaymentRequest): Observable<PaymentIntent> {
    this.validateConfirm(req);
    const correlationId = this.logger.getCorrelationId();

    this.logger.info(
      `Confirming intent`,
      this.logContext,
      { intentId: req.intentId },
      correlationId,
    );

    return this.confirmIntentRaw(req).pipe(
      map((dto) => this.mapConfirmIntent(dto)),
      tap((intent) => {
        this.logger.info(
          `Intent confirmed`,
          this.logContext,
          { intentId: intent.id, status: intent.status },
          correlationId,
        );
      }),
      catchError((err) => {
        this.logger.error(
          `Failed to confirm intent`,
          this.logContext,
          err,
          { intentId: req.intentId },
          correlationId,
        );
        return throwError(() => this.normalizeError(err));
      }),
    );
  }

  cancelIntent(req: CancelPaymentRequest): Observable<PaymentIntent> {
    this.validateCancel(req);
    const correlationId = this.logger.getCorrelationId();

    this.logger.info(
      `Canceling intent`,
      this.logContext,
      { intentId: req.intentId },
      correlationId,
    );

    return this.cancelIntentRaw(req).pipe(
      map((dto) => this.mapCancelIntent(dto)),
      tap((intent) => {
        this.logger.info(
          `Intent canceled`,
          this.logContext,
          { intentId: intent.id, status: intent.status },
          correlationId,
        );
      }),
      catchError((err) => {
        this.logger.error(
          `Failed to cancel intent`,
          this.logContext,
          err,
          { intentId: req.intentId },
          correlationId,
        );
        return throwError(() => this.normalizeError(err));
      }),
    );
  }

  getIntent(req: GetPaymentStatusRequest): Observable<PaymentIntent> {
    this.validateGetStatus(req);
    const correlationId = this.logger.getCorrelationId();

    this.logger.debug(
      `Getting intent status`,
      this.logContext,
      { intentId: req.intentId },
      correlationId,
    );

    return this.getIntentRaw(req).pipe(
      map((dto) => this.mapGetIntent(dto)),
      tap((intent) => {
        this.logger.debug(
          `Got intent status`,
          this.logContext,
          { intentId: intent.id, status: intent.status },
          correlationId,
        );
      }),
      catchError((err) => {
        this.logger.error(
          `Failed to get intent status`,
          this.logContext,
          err,
          { intentId: req.intentId },
          correlationId,
        );
        return throwError(() => this.normalizeError(err));
      }),
    );
  }

  // ------- Helpers compartidos -------
  protected validateCreate(req: CreatePaymentRequest) {
    if (!req.orderId) {
      throw invalidRequestError('errors.order_id_required', { field: 'orderId' });
    }

    if (!req.currency) {
      throw invalidRequestError('errors.currency_required', { field: 'currency' });
    }

    if (!Number.isFinite(req.amount) || req.amount <= 0) {
      throw invalidRequestError(
        'errors.amount_invalid',
        { field: 'amount', min: 1 },
        { amount: req.amount },
      );
    }

    if (!req.method?.type) {
      throw invalidRequestError('errors.method_type_required', { field: 'method.type' });
    }

    // Base rule: card requires token
    // Providers can override validateCreate() (e.g. PayPal) if they don't need it.
    if (req.method.type === 'card' && !req.method.token) {
      throw invalidRequestError('errors.card_token_required', { field: 'method.token' });
    }
  }

  protected validateConfirm(req: ConfirmPaymentRequest) {
    if (!req.intentId) {
      throw invalidRequestError('errors.intent_id_required', { field: 'intentId' });
    }
  }

  protected validateCancel(req: CancelPaymentRequest) {
    if (!req.intentId) {
      throw invalidRequestError('errors.intent_id_required', { field: 'intentId' });
    }
  }

  protected validateGetStatus(req: GetPaymentStatusRequest) {
    if (!req.intentId) {
      throw invalidRequestError('errors.intent_id_required', { field: 'intentId' });
    }
  }

  protected normalizeError(err: unknown): PaymentError {
    // If it's already a PaymentError, do NOT wrap it again.
    if (this.isPaymentError(err)) return err;

    return {
      code: 'provider_error',
      messageKey: 'errors.provider_error',
      raw: err,
    };
  }

  private isPaymentError(err: unknown): err is PaymentError {
    return typeof err === 'object' && err !== null && 'code' in err && 'messageKey' in err;
  }

  protected abstract createIntentRaw(req: CreatePaymentRequest): Observable<TCreateDto>;
  protected abstract mapIntent(dto: TCreateDto): PaymentIntent;

  protected abstract confirmIntentRaw(req: ConfirmPaymentRequest): Observable<TConfirmDto>;
  protected abstract mapConfirmIntent(dto: TConfirmDto): PaymentIntent;

  protected abstract cancelIntentRaw(req: CancelPaymentRequest): Observable<TConfirmDto>;
  protected abstract mapCancelIntent(dto: TConfirmDto): PaymentIntent;

  protected abstract getIntentRaw(req: GetPaymentStatusRequest): Observable<TConfirmDto>;
  protected abstract mapGetIntent(dto: TConfirmDto): PaymentIntent;
}
