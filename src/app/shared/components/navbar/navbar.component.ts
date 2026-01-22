import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService, I18nKeys } from '@core/i18n';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component';

/**
 * Componente navbar simple y elegante.
 *
 * Muestra el nombre de la aplicación y el selector de idioma.
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
