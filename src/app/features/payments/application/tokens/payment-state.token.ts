import { InjectionToken } from "@angular/core";
import { PaymentStatePort } from "../state/payment-state";

export const PAYMENT_STATE = new InjectionToken<PaymentStatePort>('PaymentState');