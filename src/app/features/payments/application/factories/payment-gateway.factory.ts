import { inject, Inject, Injectable } from "@angular/core";
import { PAYMENT_GATEWAYS } from "../../infrastructure/providers/payments.token";
import { PaymentGateway } from "../../domain/ports/payment-gateway.port";
import { PaymentProviderId } from "../../domain/models/payment.types";

@Injectable({ providedIn: 'root' })
export class PaymentGatewayFactory { 
    private readonly gateways = inject<PaymentGateway[]>(PAYMENT_GATEWAYS);

    get(providerId: PaymentProviderId): PaymentGateway {
        const gateway = this.gateways.find(g => g.providerId === providerId);
        if(!gateway) throw new Error(`Payment gateway for provider ${providerId} not found.`);
        return gateway;
    }
}