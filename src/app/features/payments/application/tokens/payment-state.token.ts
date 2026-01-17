import { InjectionToken } from "@angular/core";
import { PaymentStatePort } from "../state/payment-state";

export const PAYMENTS_STATE = new InjectionToken<PaymentStatePort>('PaymentsState');