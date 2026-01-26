import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';

import { LanguageSelectorComponent } from '../language-selector/language-selector.component';

/**
 * Simple, clean navbar component.
 *
 * Shows the application name and the language selector.
 *
 * @example
 * ```html
 * <app-navbar />
 * ```
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, LanguageSelectorComponent],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent {
  private readonly i18n = inject(I18nService);

  get appName(): string {
    return this.i18n.t(I18nKeys.ui.app_name);
  }
}
