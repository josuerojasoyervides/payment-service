import { Inject, Injectable } from "@angular/core";
import { PAYMENT_GATEWAYS } from "../../infrastructure/providers/payments.token";
import { PaymentGateway } from "../../domain/ports/payment-gateway.port";
import { PaymentProviderId } from "../../domain/models/payment.types";

@Injectable({ providedIn: 'root' })
export class PaymentGatewayFactory { 
    constructor(@Inject(PAYMENT_GATEWAYS) private gateways: PaymentGateway[]) { }

    get(providerId: PaymentProviderId): PaymentGateway {
        const gateway = this.gateways.find(g => g.providerId === providerId);
        if(!gateway) throw new Error(`Payment gateway for provider ${providerId} not found.`);
        return gateway;
    }
}