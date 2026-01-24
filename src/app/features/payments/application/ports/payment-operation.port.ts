import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { I18nKeys } from '@core/i18n';
import { LoggerService } from '@core/logging';
import { PaymentError } from '@payments/domain/models/payment/payment-error.types';
import { PaymentProviderId } from '@payments/domain/models/payment/payment-intent.types';
import { catchError, map, Observable, throwError } from 'rxjs';

export interface PaymentOperationGatewayPort<TRequest, TResponse> {
  execute(request: TRequest): Observable<TResponse>;
}

export abstract class PaymentOperationPort<
  TRequest,
  TDto,
  TResponse,
> implements PaymentOperationGatewayPort<TRequest, TResponse> {
  abstract readonly providerId: PaymentProviderId;
  protected readonly http = inject(HttpClient);
  protected readonly logger = inject(LoggerService);

  protected get logContext(): string {
    return `${this.providerId} Gateway`;
  }

  execute(request: TRequest): Observable<TResponse> {
    this.validateRequest(request);

    return this.executeRaw(request).pipe(
      map((dto) => this.mapResponse(dto)),
      catchError((err) => throwError(() => this.handleError(err))),
    );
  }

  protected validateRequest(_request: TRequest): void {
    // Optionally override in subclasses to perform request validation.
  }

  protected handleError(err: unknown): PaymentError {
    return {
      code: 'provider_error',
      messageKey: I18nKeys.errors.provider_error,
      raw: err,
    };
  }

  protected abstract executeRaw(request: TRequest): Observable<TDto>;
  protected abstract mapResponse(dto: TDto): TResponse;
}
