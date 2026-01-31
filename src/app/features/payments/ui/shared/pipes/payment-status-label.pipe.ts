import type { PipeTransform } from '@angular/core';
import { inject, Pipe } from '@angular/core';
import type { PaymentIntent } from '@app/features/payments/domain/subdomains/payment/entities/payment-intent.types';
import { I18nService } from '@core/i18n';
import { getStatusText } from '@payments/ui/shared/ui.types';

@Pipe({
  name: 'paymentStatusLabel',
  standalone: true,
  pure: true,
})
export class PaymentStatusLabelPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(status: PaymentIntent['status'] | string | null | undefined): string {
    if (!status) return '';
    return getStatusText(this.i18n, status);
  }
}
