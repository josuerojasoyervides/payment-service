import type { Provider } from '@angular/core';
import { PaymentOptionsForm } from '@app/features/payments/ui/forms/payment-options/payment-options-form';

const UI_FORMS_PROVIDERS: Provider[] = [PaymentOptionsForm];

export const UI_PROVIDERS: Provider[] = [...UI_FORMS_PROVIDERS];
