import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';
import { LoggerService } from '@core/logging';
import { PaymentError, PaymentProviderId } from '@payments/domain/models';
import { PaymentGatewayRefactor } from '@payments/domain/ports';
import { catchError, map, Observable, throwError } from 'rxjs';

export abstract class PaymentGatewayOperation<
  TRequest,
  TDto,
  TResponse,
> implements PaymentGatewayRefactor<TRequest, TResponse> {
  abstract readonly providerId: PaymentProviderId;
  protected readonly http = inject(HttpClient);
  protected readonly logger = inject(LoggerService);
  protected readonly i18n = inject(I18nService);

  protected get logContext(): string {
    return `${this.providerId}Gateway`;
  }

  execute(request: TRequest): Observable<TResponse> {
    return this.executeRaw(request).pipe(
      map((dto) => this.mapResponse(dto)),
      catchError((err) => throwError(() => this.handleError(err))),
    );
  }

  protected handleError(err: unknown): PaymentError {
    // Aquí podrías “mapear” por tipo de error, status code, etc.
    return {
      code: 'provider_error',
      message: this.i18n.t(I18nKeys.errors.provider_error),
      raw: err,
    };
  }

  protected abstract executeRaw(request: TRequest): Observable<TDto>;
  protected abstract mapResponse(dto: TDto): TResponse;
}
