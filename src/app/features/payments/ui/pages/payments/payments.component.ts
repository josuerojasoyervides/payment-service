import { Component, inject, OnInit } from "@angular/core";
import { tap } from "rxjs";
import { StartPaymentUseCase } from "../../../application/use-cases/start-payment.use-case";
import { CreatePaymentRequest } from "../../../domain/models/payment.types";
import { PaymentsFacade } from "../../facades/payments-facade";

@Component({
    selector: 'app-payments',
    templateUrl: './payments.component.html',
})
export class PaymentsComponent implements OnInit {
    readonly facade = inject(PaymentsFacade);

    ngOnInit() {
        const req: CreatePaymentRequest = {
            orderId: 'order_123',
            amount: 1000,
            currency: 'USD',
            method: { type: 'card', token: 'tok_demo' } // <- ojo token
        };

        this.facade.start(req);
    }
}