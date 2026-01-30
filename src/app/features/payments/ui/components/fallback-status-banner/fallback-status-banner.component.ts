import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';
import type { FallbackStatus } from '@payments/domain/subdomains/fallback/contracts/fallback-state.types';

/**
 * Non-modal banner shown when fallback is executing or auto-executing.
 * User can cancel the fallback via the Cancel button.
 */
@Component({
  selector: 'app-fallback-status-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fallback-status-banner.component.html',
})
export class FallbackStatusBannerComponent {
  private readonly i18n = inject(I18nService);

  readonly isExecuting = input<boolean>(false);
  readonly isAuto = input<boolean>(false);
  readonly status = input<FallbackStatus | undefined>(undefined);

  readonly canceled = output<void>();

  readonly visible = computed(() => this.isExecuting() === true || this.isAuto() === true);

  readonly title = computed(() => this.i18n.t(I18nKeys.ui.fallback_in_progress_title));
  readonly hint = computed(() =>
    this.isAuto()
      ? this.i18n.t(I18nKeys.ui.fallback_auto_hint)
      : this.i18n.t(I18nKeys.ui.fallback_in_progress_hint),
  );
  readonly cancelLabel = computed(() => this.i18n.t(I18nKeys.ui.cancel));

  onCancel(): void {
    this.canceled.emit();
  }
}
