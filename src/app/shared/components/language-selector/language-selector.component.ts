import { CommonModule } from '@angular/common';
import { Component, computed, HostListener, inject } from '@angular/core';
import { I18nKeys, I18nService } from '@core/i18n';

export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}

/**
 * Componente selector de idioma.
 *
 * Muestra un selector dropdown elegante para cambiar el idioma de la aplicación.
 *
 * @example
 * ```html
 * <app-language-selector />
 * ```
 */
@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './language-selector.component.html',
  styleUrls: ['./language-selector.component.scss'],
})
export class LanguageSelectorComponent {
  private readonly i18n = inject(I18nService);

  readonly languages: LanguageOption[] = [
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
  ];

  /** Idioma actual */
  readonly currentLang = this.i18n.currentLang;

  /** Idioma seleccionado con metadata */
  readonly selectedLanguage = computed(() => {
    const lang = this.currentLang();
    return this.languages.find((l) => l.code === lang) || this.languages[0];
  });

  isOpen = false;

  /**
   * Cambia el idioma de la aplicación.
   */
  selectLanguage(langCode: string): void {
    this.i18n.setLanguage(langCode);
    this.isOpen = false;
  }

  /**
   * Alterna el estado del dropdown.
   */
  toggleDropdown(): void {
    this.isOpen = !this.isOpen;
  }

  /**
   * Cierra el dropdown.
   */
  closeDropdown(): void {
    this.isOpen = false;
  }

  get selectLanguageLabel(): string {
    return this.i18n.t(I18nKeys.ui.select_language);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.language-selector-container')) {
      this.closeDropdown();
    }
  }
}
