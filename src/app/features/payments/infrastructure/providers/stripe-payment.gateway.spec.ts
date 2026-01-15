import { TestBed } from '@angular/core/testing';
import { StripePaymentGateway } from './stripe-payment.gateway'

describe('StripePaymentGateway', () => {
    let stripePaymentGateway: StripePaymentGateway;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [StripePaymentGateway]
        })
    })
})