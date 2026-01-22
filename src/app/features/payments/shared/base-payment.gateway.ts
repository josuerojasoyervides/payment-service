import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';
import { LoggerService } from '@core/logging';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import {
  PaymentIntent,
  PaymentProviderId,
} from '@payments/domain/models/payment/payment-intent.types';
import {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@payments/domain/models/payment/payment-request.types';
import { PaymentGateway } from '@payments/domain/ports';
import { catchError, map, Observable, tap, throwError } from 'rxjs';

export abstract class BasePaymentGateway<
  TCreateDto = unknown,
  TConfirmDto = unknown,
> implements PaymentGateway {
  abstract readonly providerId: PaymentProviderId;

  protected readonly http = inject(HttpClient);
  protected readonly logger = inject(LoggerService);
  protected readonly i18n = inject(I18nService);

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
    if (!req.orderId) throw new Error(this.i18n.t(I18nKeys.errors.order_id_required));
    if (!req.currency) throw new Error(this.i18n.t(I18nKeys.errors.currency_required));
    if (!Number.isFinite(req.amount) || req.amount <= 0)
      throw new Error(this.i18n.t(I18nKeys.errors.amount_invalid));
    if (!req.method?.type) throw new Error(this.i18n.t(I18nKeys.errors.method_type_required));
    if (req.method.type === 'card' && !req.method.token)
      throw new Error(this.i18n.t(I18nKeys.errors.card_token_required));
  }

  protected validateConfirm(req: ConfirmPaymentRequest) {
    if (!req.intentId) throw new Error(this.i18n.t(I18nKeys.errors.intent_id_required));
  }

  protected validateCancel(req: CancelPaymentRequest) {
    if (!req.intentId) throw new Error(this.i18n.t(I18nKeys.errors.intent_id_required));
  }

  protected validateGetStatus(req: GetPaymentStatusRequest) {
    if (!req.intentId) throw new Error(this.i18n.t(I18nKeys.errors.intent_id_required));
  }

  protected normalizeError(err: unknown): PaymentError {
    return {
      code: 'provider_error',
      message: this.i18n.t(I18nKeys.errors.provider_error),
      raw: err,
    };
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
