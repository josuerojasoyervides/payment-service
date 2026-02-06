import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';
import { ThemeService } from '@shared/theme/theme.service';

/**
 * Theme toggle button (dark/light).
 *
 * Encapsulates theme state and persistence via ThemeService.
 */
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './theme-toggle.component.html',
})
export class ThemeToggleComponent {
  private readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);

  readonly isDark = computed(() => this.theme.mode() === 'dark');
  readonly label = computed(() =>
    this.i18n.t(this.isDark() ? I18nKeys.ui.theme_light : I18nKeys.ui.theme_dark),
  );
  readonly hint = computed(() => this.i18n.t(I18nKeys.ui.theme_toggle));

  toggle(): void {
    this.theme.toggle();
  }
}
