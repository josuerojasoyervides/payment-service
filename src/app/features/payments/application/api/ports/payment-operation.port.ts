import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import type { PaymentError } from '@app/features/payments/domain/subdomains/payment/entities/payment-error.model';
import type { PaymentProviderId } from '@app/features/payments/domain/subdomains/payment/entities/payment-provider.types';
import { LoggerService } from '@core/logging';
import type { Observable } from 'rxjs';
import { catchError, map, throwError } from 'rxjs';

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
      messageKey: 'errors.provider_error',
      raw: err,
    };
  }

  protected abstract executeRaw(request: TRequest): Observable<TDto>;
  protected abstract mapResponse(dto: TDto): TResponse;
}
