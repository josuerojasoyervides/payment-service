import { InjectionToken } from "@angular/core";
import { PaymentGateway } from "../../domain/ports/payment-gateway.port";

export const PAYMENT_GATEWAYS = new InjectionToken<PaymentGateway[]>("PAYMENT_GATEWAYS");