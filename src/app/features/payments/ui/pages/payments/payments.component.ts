import { Component, inject, OnInit } from "@angular/core";
import { tap } from "rxjs";
import { StartPaymentUseCase } from "../../../application/use-cases/start-payment.use-case";
import { CreatePaymentRequest } from "../../../domain/models/payment.types";

@Component({
    selector: 'app-payments',
    templateUrl: './payments.component.html',
})
export class PaymentsComponent implements OnInit {
    private readonly startPaymentUseCase = inject(StartPaymentUseCase);

    ngOnInit() {
        const createPaymentRequest: CreatePaymentRequest = {
            orderId: 'order_123',
            amount: 1000,
            currency: 'USD',
            method: {
                type: 'card',
            }
        };

        this.startPaymentUseCase.execute(createPaymentRequest).pipe(
            tap(paymentIntent => { 
                console.log('Payment Intent:', paymentIntent);
            }
        )).subscribe();
    }
}