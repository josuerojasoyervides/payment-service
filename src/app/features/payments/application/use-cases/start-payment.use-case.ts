import { inject, Injectable } from '@angular/core';
import { CreatePaymentRequest, PaymentIntent } from '../../domain/models/payment.types';
import { Observable } from 'rxjs';
import { PaymentStrategyFactory } from '../factories/payment-strategy.factory';

@Injectable({providedIn: 'root'})
export class StartPaymentUseCase {
    private readonly defaultProvider = 'stripe' as const;
    
    private readonly strategyFactory = inject(PaymentStrategyFactory);

    execute(req: CreatePaymentRequest): Observable<PaymentIntent> {
        const strategy = this.strategyFactory.create(this.defaultProvider, req.method.type)
        return strategy.start(req);
    }
}