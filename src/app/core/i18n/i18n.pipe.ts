import type { PipeTransform } from '@angular/core';
import { inject, Pipe } from '@angular/core';

import { I18nService } from './i18n.service';

@Pipe({
  name: 'i18n',
  standalone: true,
  pure: true,
})
export class I18nPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key?: string | null, params?: Record<string, string | number>): string {
    if (!key) return '';
    return this.i18n.t(key, params);
  }
}
