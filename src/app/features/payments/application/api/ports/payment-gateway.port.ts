import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { invalidRequestError } from '@app/features/payments/domain/subdomains/payment/factories/payment-error.factory';
import type {
  CancelPaymentRequest,
  ConfirmPaymentRequest,
  CreatePaymentRequest,
  GetPaymentStatusRequest,
} from '@app/features/payments/domain/subdomains/payment/messages/payment-request.command';
import { LoggerService } from '@core/logging';
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
      {
        orderId: req.orderId.value,
        amount: req.money.amount,
        currency: req.money.currency,
        method: req.method.type,
      },
      correlationId,
    );

    return this.createIntentRaw(req).pipe(
      map((dto) => this.mapIntent(dto)),
      tap((intent) => {
        this.logger.info(
          `Payment intent created`,
          this.logContext,
          { intentId: intent.id.value, status: intent.status },
          correlationId,
        );
      }),
      catchError((err) => {
        this.logger.error(
          `Failed to create payment intent`,
          this.logContext,
          err,
          { orderId: req.orderId.value },
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
      { intentId: req.intentId.value },
      correlationId,
    );

    return this.confirmIntentRaw(req).pipe(
      map((dto) => this.mapConfirmIntent(dto)),
      tap((intent) => {
        this.logger.info(
          `Intent confirmed`,
          this.logContext,
          { intentId: intent.id.value, status: intent.status },
          correlationId,
        );
      }),
      catchError((err) => {
        this.logger.error(
          `Failed to confirm intent`,
          this.logContext,
          err,
          { intentId: req.intentId.value },
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
      { intentId: req.intentId.value },
      correlationId,
    );

    return this.cancelIntentRaw(req).pipe(
      map((dto) => this.mapCancelIntent(dto)),
      tap((intent) => {
        this.logger.info(
          `Intent canceled`,
          this.logContext,
          { intentId: intent.id.value, status: intent.status },
          correlationId,
        );
      }),
      catchError((err) => {
        this.logger.error(
          `Failed to cancel intent`,
          this.logContext,
          err,
          { intentId: req.intentId.value },
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
      { intentId: req.intentId.value },
      correlationId,
    );

    return this.getIntentRaw(req).pipe(
      map((dto) => this.mapGetIntent(dto)),
      tap((intent) => {
        this.logger.debug(
          `Got intent status`,
          this.logContext,
          { intentId: intent.id.value, status: intent.status },
          correlationId,
        );
      }),
      catchError((err) => {
        this.logger.error(
          `Failed to get intent status`,
          this.logContext,
          err,
          { intentId: req.intentId.value },
          correlationId,
        );
        return throwError(() => this.normalizeError(err));
      }),
    );
  }

  // ------- Helpers compartidos -------
  protected validateCreate(req: CreatePaymentRequest) {
    if (!req.orderId?.value) {
      throw invalidRequestError('errors.order_id_required', { field: 'orderId' });
    }

    if (!req.money?.currency) {
      throw invalidRequestError('errors.currency_required', { field: 'currency' });
    }

    if (!Number.isFinite(req.money.amount) || req.money.amount <= 0) {
      throw invalidRequestError(
        'errors.amount_invalid',
        { field: 'amount', min: 1 },
        { amount: req.money.amount },
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
